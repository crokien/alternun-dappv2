#![no_std]

use soroban_sdk::{
    contract, contractimpl, Env, Address, Symbol,
    symbol_short, panic_with_error, contracterror,
};

pub struct State;
impl State {
    pub const INIT: Symbol = symbol_short!("init");
    pub const ADMIN: Symbol = symbol_short!("admin");
    pub const PRICE: Symbol = symbol_short!("price");
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum OracleError {
    NotAdmin = 1,
    NotInitialized = 2,
}

#[contract]
pub struct OracleMock;

#[contractimpl]
impl OracleMock {
    pub fn init(e: Env, admin: Address, initial_price_scaled_1e7: i128) {
        if e.storage().instance().has(&State::INIT) {
            return; // ya inicializado
        }
        admin.require_auth();

        e.storage().instance().set(&State::ADMIN, &admin);
        e.storage().instance().set(&State::PRICE, &initial_price_scaled_1e7);
        e.storage().instance().set(&State::INIT, &true);
    }

    pub fn set_price(e: Env, admin: Address, new_price_scaled_1e7: i128) {
        let stored_admin: Address = e.storage().instance().get(&State::ADMIN).unwrap();
        if admin != stored_admin {
            panic_with_error!(&e, OracleError::NotAdmin);
        }
        admin.require_auth();

        e.storage().instance().set(&State::PRICE, &new_price_scaled_1e7);
    }

    pub fn get_price(e: Env) -> i128 {
        e.storage().instance().get(&State::PRICE).unwrap_or(0_i128)
    }
}
