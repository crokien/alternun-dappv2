#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env,
    token::Client as TokenClient,
};

// --- Constantes y pesos ---
const BPS: i128 = 10_000; // 100% = 10_000
const W_INFERIDOS: i128 = 1_500; // 0.15
const W_INDICADOS: i128 = 3_000; // 0.30
const W_MEDIDOS:   i128 = 6_000; // 0.60
const W_PROBABLES: i128 = 5_000; // 0.50
const W_PROBADAS:  i128 = 7_000; // 0.70

// --- Oracle client ---
mod oracle {
    use soroban_sdk::{Env, contractclient};
    #[contractclient(name = "OracleClient")]
    pub trait Oracle {
        fn get_price(e: Env) -> i128; // USD/gramo escalado a 1e7
    }
}

// --- Treasury client ---
mod treasury {
    use soroban_sdk::{Env, Address, contractclient};
    #[contractclient(name = "TreasuryClient")]
    pub trait Treasury {
        fn route(e: Env, token: Address, from: Address, amount: i128);
    }
}

// --- GBT token client (expone mint) ---
// Importante: el admin del token debe ser ESTE contrato (el minter), así el mint
// no requiere la firma de un G-address en cada llamada.
mod gbt_token {
    use soroban_sdk::{Env, Address, contractclient};
    #[contractclient(name = "GbtTokenClient")]
    pub trait GbtToken {
        fn mint(e: Env, to: Address, amount: i128);
    }
}

#[contracttype]
#[derive(Clone)]
pub struct MineData {
    // cantidades en gramos * 1000 (3 decimales)
    pub inferidos_gm: i128,
    pub indicados_gm: i128,
    pub medidos_gm:   i128,
    pub probables_gm: i128,
    pub probadas_gm:  i128,
    pub enabled: bool,
}

#[contracttype]
pub enum DataKey {
    Admin,
    TokenGbt,
    TokenStable,
    Treasury,
    Oracle,
    FeeBps,   // fee de minteo en bps (def 200 = 2%)
    FcBps,    // factor comercial en bps (def 8000 = 80%)
    Paused,
    MintedGm, // total minteado (g*1000)
    Mine(u32),
}

fn read_admin(e: &Env) -> Address { e.storage().instance().get(&DataKey::Admin).unwrap() }
fn read_token_gbt(e: &Env) -> Address { e.storage().instance().get(&DataKey::TokenGbt).unwrap() }
fn read_token_stable(e: &Env) -> Address { e.storage().instance().get(&DataKey::TokenStable).unwrap() }
fn read_treasury(e: &Env) -> Address { e.storage().instance().get(&DataKey::Treasury).unwrap() }
fn read_oracle(e: &Env) -> Address { e.storage().instance().get(&DataKey::Oracle).unwrap() }
fn read_fcbps(e: &Env) -> i128 { e.storage().instance().get(&DataKey::FcBps).unwrap() }
fn read_fee_bps(e: &Env) -> i128 { e.storage().instance().get(&DataKey::FeeBps).unwrap() }

fn capacity_of_mine(m: &MineData, fc_bps: i128) -> i128 {
    let sum = m.inferidos_gm * W_INFERIDOS
        + m.indicados_gm * W_INDICADOS
        + m.medidos_gm   * W_MEDIDOS
        + m.probables_gm * W_PROBABLES
        + m.probadas_gm  * W_PROBADAS;
    (sum * fc_bps) / (BPS * BPS)
}

#[contracttype]
#[derive(Clone)]
pub struct Preview {
    pub gbt_out_gm: i128,        // gramos*1000
    pub net_stable_1e7: i128,    // neto tras fee
    pub fee_stable_1e7: i128,    // fee cobrado
    pub price_1e7: i128,         // USD/g (1e7)
    pub meets_min: bool,         // >= 1.000 gbt (1 gramo)
    pub capacity_left_gm: i128,  // capacidad restante (g*1000)
}

#[contract]
pub struct GbtMinterV2;

#[contractimpl]
impl GbtMinterV2 {
    pub fn init(
        e: Env,
        admin: Address,
        token_gbt: Address,
        token_stable: Address,
        treasury: Address,
        oracle: Address,
        fee_bps: u32,
        fc_bps: u32,
    ) {
        if e.storage().instance().has(&DataKey::Admin) { return; }
        admin.require_auth();

        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::TokenGbt, &token_gbt);
        e.storage().instance().set(&DataKey::TokenStable, &token_stable);
        e.storage().instance().set(&DataKey::Treasury, &treasury);
        e.storage().instance().set(&DataKey::Oracle, &oracle);

        let fee = if fee_bps == 0 { 200 } else { fee_bps } as i128;
        let fc  = if fc_bps  == 0 { 8000 } else { fc_bps } as i128;
        e.storage().instance().set(&DataKey::FeeBps, &fee);
        e.storage().instance().set(&DataKey::FcBps, &fc);
        e.storage().instance().set(&DataKey::Paused, &false);
        e.storage().instance().set(&DataKey::MintedGm, &0i128);
    }

    pub fn set_fc_bps(e: Env, fc_bps: u32) {
        let admin = read_admin(&e); admin.require_auth();
        e.storage().instance().set(&DataKey::FcBps, &(fc_bps as i128));
    }

    pub fn set_fee_bps(e: Env, fee_bps: u32) {
        let admin = read_admin(&e); admin.require_auth();
        e.storage().instance().set(&DataKey::FeeBps, &(fee_bps as i128));
    }

    pub fn set_paused(e: Env, paused: bool) {
        let admin = read_admin(&e); admin.require_auth();
        e.storage().instance().set(&DataKey::Paused, &paused);
    }

    pub fn upsert_mine(
        e: Env,
        id: u32,
        inferidos_gm: i128,
        indicados_gm: i128,
        medidos_gm: i128,
        probables_gm: i128,
        probadas_gm: i128,
        enabled: bool,
    ) {
        let admin = read_admin(&e); admin.require_auth();
        let m = MineData { inferidos_gm, indicados_gm, medidos_gm, probables_gm, probadas_gm, enabled };
        e.storage().instance().set(&DataKey::Mine(id), &m);
    }

    pub fn get_mine(e: Env, id: u32) -> MineData {
        e.storage().instance().get(&DataKey::Mine(id)).unwrap_or(MineData {
            inferidos_gm: 0, indicados_gm: 0, medidos_gm: 0, probables_gm: 0, probadas_gm: 0, enabled: false
        })
    }

    pub fn mine_capacity_gm(e: Env, id: u32) -> i128 {
        let m = Self::get_mine(e.clone(), id);
        if !m.enabled { return 0; }
        let fc = read_fcbps(&e);
        capacity_of_mine(&m, fc)
    }

    pub fn total_capacity_gm(e: Env, max_id_inclusive: u32) -> i128 {
        let fc = read_fcbps(&e);
        let mut total: i128 = 0;
        let mut i: u32 = 0;
        while i <= max_id_inclusive {
            if let Some(m) = e.storage().instance().get::<_, MineData>(&DataKey::Mine(i)) {
                if m.enabled { total += capacity_of_mine(&m, fc); }
            }
            i += 1;
        }
        total
    }

    pub fn available_capacity_gm(e: Env, max_id_inclusive: u32) -> i128 {
        let total = Self::total_capacity_gm(e.clone(), max_id_inclusive);
        let minted = e.storage().instance().get::<_, i128>(&DataKey::MintedGm).unwrap_or(0);
        let avail = total - minted;
        if avail < 0 { 0 } else { avail }
    }

    pub fn preview_mint(e: Env, amount_stable_1e7: i128, max_id_inclusive: u32) -> Preview {
        let fee_bps = read_fee_bps(&e);
        let price_1e7 = crate::oracle::OracleClient::new(&e, &read_oracle(&e)).get_price();
        let avail = Self::available_capacity_gm(e.clone(), max_id_inclusive);

        if amount_stable_1e7 <= 0 || price_1e7 <= 0 || avail <= 0 {
            return Preview {
                gbt_out_gm: 0, net_stable_1e7: 0, fee_stable_1e7: 0,
                price_1e7, meets_min: false, capacity_left_gm: avail.max(0)
            };
        }

        let fee = (amount_stable_1e7 * fee_bps) / BPS;
        let net = amount_stable_1e7 - fee;

        // gbt_out_gm = floor((net / price) * 1000)
        let mut gbt_out_gm = (net * 1000) / price_1e7;
        let meets_min = gbt_out_gm >= 1000; // mínimo 1 gramo
        if !meets_min { gbt_out_gm = 0; }
        if gbt_out_gm > avail { gbt_out_gm = avail; }

        let cap_left = if avail >= gbt_out_gm { avail - gbt_out_gm } else { 0 };
        Preview {
            gbt_out_gm,
            net_stable_1e7: net,
            fee_stable_1e7: fee,
            price_1e7,
            meets_min,
            capacity_left_gm: cap_left
        }
    }

    pub fn mint(e: Env, payer: Address, amount_stable_1e7: i128, max_id_inclusive: u32) {
        // 0) Pausa y auth del payer (clave para las transferencias desde su cuenta)
        let paused = e.storage().instance().get::<_, bool>(&DataKey::Paused).unwrap_or(false);
        if paused { panic!("mint paused"); }
        payer.require_auth();

        // 1) Preview y validaciones
        let p = Self::preview_mint(e.clone(), amount_stable_1e7, max_id_inclusive);
        if !p.meets_min || p.gbt_out_gm <= 0 { panic!("below minimum or zero"); }

        // 2) Fee al admin y neto a Treasury.route (ambos DESDE payer)
        let stable = TokenClient::new(&e, &read_token_stable(&e));
        let admin = read_admin(&e);

        if p.fee_stable_1e7 > 0 {
            stable.transfer(&payer, &admin, &p.fee_stable_1e7);
        }
        if p.net_stable_1e7 > 0 {
            // El treasury hará los splits (50/30/20) usando `from = payer`
            let tres = crate::treasury::TreasuryClient::new(&e, &read_treasury(&e));
            tres.route(&read_token_stable(&e), &payer, &p.net_stable_1e7);
        }

        // 3) Minteo GBT al payer
        // gbt_out_gm (g*1000) -> unidades del token (7 dec): *10^4
        let gbt_units = p.gbt_out_gm * 10_000;
        let gbt_addr = read_token_gbt(&e);
        let gbt = crate::gbt_token::GbtTokenClient::new(&e, &gbt_addr);
        gbt.mint(&payer, &gbt_units);

        // 4) Acumula minteado
        let prev = e.storage().instance().get::<_, i128>(&DataKey::MintedGm).unwrap_or(0);
        e.storage().instance().set(&DataKey::MintedGm, &(prev + p.gbt_out_gm));
    }
}
