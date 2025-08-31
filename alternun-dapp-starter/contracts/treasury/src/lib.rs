#![no_std]

use soroban_sdk::{
    contract, contractimpl,
    Env, Address, Symbol,
    symbol_short,
    token::Client as TokenClient,
    panic_with_error, contracterror,
};

pub struct State;
impl State {
    pub const ADMIN: Symbol  = symbol_short!("admin");
    pub const ADDR_P: Symbol = symbol_short!("addr_p"); // projects
    pub const ADDR_R: Symbol = symbol_short!("addr_r"); // recovery
    pub const ADDR_A: Symbol = symbol_short!("addr_a"); // alternun
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TreasuryError {
    NotAdmin = 1,
}

#[contract]
pub struct Treasury;

#[contractimpl]
impl Treasury {
    pub fn init(e: Env, admin: Address, addr_p: Address, addr_r: Address, addr_a: Address) {
        if e.storage().instance().has(&State::ADMIN) {
            return;
        }
        admin.require_auth();

        e.storage().instance().set(&State::ADMIN, &admin);
        e.storage().instance().set(&State::ADDR_P, &addr_p);
        e.storage().instance().set(&State::ADDR_R, &addr_r);
        e.storage().instance().set(&State::ADDR_A, &addr_a);
    }

    /// 🔧 Nuevo: permite actualizar las 3 direcciones de destino (solo admin)
    pub fn set_pools(e: Env, admin: Address, addr_p: Address, addr_r: Address, addr_a: Address) {
        let stored_admin: Address = e.storage().instance().get(&State::ADMIN).unwrap();
        if admin != stored_admin {
            panic_with_error!(&e, TreasuryError::NotAdmin);
        }
        admin.require_auth();

        e.storage().instance().set(&State::ADDR_P, &addr_p);
        e.storage().instance().set(&State::ADDR_R, &addr_r);
        e.storage().instance().set(&State::ADDR_A, &addr_a);
    }

    /// Divide `amount` en 50/30/20 y transfiere con el token estándar.
    pub fn route(e: Env, token: Address, from: Address, amount: i128) {
        let addr_p: Address = e.storage().instance().get(&State::ADDR_P).unwrap();
        let addr_r: Address = e.storage().instance().get(&State::ADDR_R).unwrap();
        let addr_a: Address = e.storage().instance().get(&State::ADDR_A).unwrap();

        // Cliente del contrato token
        let token_client = TokenClient::new(&e, &token);

        // Autorización del `from`
        from.require_auth();

        // Cálculos
        let p = amount * 50 / 100;
        let r = amount * 30 / 100;
        let a = amount * 20 / 100;

        // Transferencias
        token_client.transfer(&from, &addr_p, &p);
        token_client.transfer(&from, &addr_r, &r);
        token_client.transfer(&from, &addr_a, &a);
    }
}
