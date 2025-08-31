#![no_std]
use soroban_sdk::{
    contract, contractimpl, Env, Address, Symbol, symbol_short, Map,
    panic_with_error, contracterror,
};

pub struct Keys;
impl Keys {
    pub const ADMIN: Symbol = symbol_short!("admin");
    pub const BAL:   Symbol = symbol_short!("bal");
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Err {
    NotAdmin = 1,
    Insufficient = 2,
}

fn balances(e: &Env) -> Map<Address, i128> {
    e.storage().instance().get(&Keys::BAL).unwrap_or(Map::new(e))
}
fn save_balances(e: &Env, m: &Map<Address, i128>) {
    e.storage().instance().set(&Keys::BAL, m);
}

#[contract]
pub struct GbtTokenMin;

#[contractimpl]
impl GbtTokenMin {
    pub fn init(e: Env, admin: Address) {
        if e.storage().instance().has(&Keys::ADMIN) { return; }
        admin.require_auth();
        e.storage().instance().set(&Keys::ADMIN, &admin);
        let m: Map<Address, i128> = Map::new(&e);
        e.storage().instance().set(&Keys::BAL, &m);
    }

    /// Permite transferir la administración del token a otra Address (cuenta o contrato).
    pub fn set_admin(e: Env, current_admin: Address, new_admin: Address) {
        let stored: Address = e.storage().instance().get(&Keys::ADMIN).unwrap();
        if current_admin != stored {
            panic_with_error!(&e, Err::NotAdmin);
        }
        current_admin.require_auth();
        e.storage().instance().set(&Keys::ADMIN, &new_admin);
    }

    pub fn mint(e: Env, to: Address, amount: i128) {
        let admin: Address = e.storage().instance().get(&Keys::ADMIN).unwrap();
        admin.require_auth();
        let mut m = balances(&e);
        let cur = m.get(to.clone()).unwrap_or(0);
        m.set(to, cur + amount);
        save_balances(&e, &m);
    }

    pub fn transfer(e: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        let mut m = balances(&e);
        let bal_from = m.get(from.clone()).unwrap_or(0);
        if bal_from < amount {
            panic_with_error!(&e, Err::Insufficient);
        }
        m.set(from, bal_from - amount);
        let bal_to = m.get(to.clone()).unwrap_or(0);
        m.set(to, bal_to + amount);
        save_balances(&e, &m);
    }

    pub fn balance(e: Env, owner: Address) -> i128 {
        balances(&e).get(owner).unwrap_or(0)
    }
}
