#![no_std]

use soroban_sdk::{
    contract, contractimpl,
    Env, Address, Symbol,
    symbol_short,
    token::Client as TokenClient,
};

pub struct State;
impl State {
    pub const ADMIN: Symbol        = symbol_short!("admin");
    pub const TOKEN_GBT: Symbol    = symbol_short!("gbt");
    pub const TOKEN_STABLE: Symbol = symbol_short!("stc");
    pub const TREASURY: Symbol     = symbol_short!("tres");
    pub const ORACLE: Symbol       = symbol_short!("orcl");
}

#[contract]
pub struct GbtMinting;

// ---- Clientes de contratos externos ----
mod oracle {
    use soroban_sdk::{Env, contractclient};

    #[contractclient(name = "OracleClient")]
    pub trait Oracle {
        fn get_price(e: Env) -> i128;
    }
}

mod treasury {
    use soroban_sdk::{Env, Address, contractclient};

    #[contractclient(name = "TreasuryClient")]
    pub trait Treasury {
        fn route(e: Env, token: Address, from: Address, amount: i128);
    }
}

// Cliente explícito del contrato GBT con método `mint` (admin)
mod gbt_token {
    use soroban_sdk::{Env, Address, contractclient};

    #[contractclient(name = "GbtClient")]
    pub trait GbtToken {
        fn mint(e: Env, to: Address, amount: i128);
    }
}

#[contractimpl]
impl GbtMinting {
    pub fn init(
        e: Env,
        admin: Address,
        token_gbt: Address,
        token_stable: Address,
        treasury: Address,
        oracle: Address,
    ) {
        if e.storage().instance().has(&State::ADMIN) {
            return;
        }
        admin.require_auth();

        e.storage().instance().set(&State::ADMIN, &admin);
        e.storage().instance().set(&State::TOKEN_GBT, &token_gbt);
        e.storage().instance().set(&State::TOKEN_STABLE, &token_stable);
        e.storage().instance().set(&State::TREASURY, &treasury);
        e.storage().instance().set(&State::ORACLE, &oracle);
    }

    pub fn mint(e: Env, payer: Address, amount_stable: i128) {
        // Recuperar contratos desde storage
        let token_gbt: Address    = e.storage().instance().get(&State::TOKEN_GBT).unwrap();
        let token_stable: Address = e.storage().instance().get(&State::TOKEN_STABLE).unwrap();
        let treasury: Address     = e.storage().instance().get(&State::TREASURY).unwrap();
        let oracle: Address       = e.storage().instance().get(&State::ORACLE).unwrap();

        // 1) Precio desde oracle (placeholder)
        let oracle_client = crate::oracle::OracleClient::new(&e, &oracle);
        let _price_scaled: i128 = oracle_client.get_price();

        // 2) Calcular GBT a mintear (placeholder: 1:1 hasta integrar la fórmula real)
        let gbt_out: i128 = amount_stable;

        // 3) Split 50/30/20 directamente desde el payer (requiere su firma)
        payer.require_auth();
        let tres = crate::treasury::TreasuryClient::new(&e, &treasury);
        tres.route(&token_stable, &payer, &amount_stable);

        // 4) Mintear GBT al payer (este contrato es admin del token GBT)
        let gbt = crate::gbt_token::GbtClient::new(&e, &token_gbt);
        gbt.mint(&payer, &gbt_out);
    }
}
