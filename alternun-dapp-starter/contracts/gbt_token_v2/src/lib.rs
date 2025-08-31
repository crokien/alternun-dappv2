#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, symbol_short};

#[contracttype]
enum Key {
    Admin,
    Decimals,
    Name,
    Symbol,
    Bal(Address), // balance por address
}

fn read_admin(e: &Env) -> Address {
    e.storage().instance().get::<_, Address>(&Key::Admin).unwrap()
}
fn get_balance(e: &Env, who: &Address) -> i128 {
    e.storage().instance().get::<_, i128>(&Key::Bal(who.clone())).unwrap_or(0)
}
fn set_balance(e: &Env, who: &Address, v: i128) {
    e.storage().instance().set(&Key::Bal(who.clone()), &v);
}

#[contract]
pub struct GbtTokenV2;

#[contractimpl]
impl GbtTokenV2 {
    pub fn init(e: Env, admin: Address, decimals: u32, name: soroban_sdk::String, symbol: soroban_sdk::String) {
        if e.storage().instance().has(&Key::Admin) { return; }
        admin.require_auth();
        e.storage().instance().set(&Key::Admin, &admin);
        e.storage().instance().set(&Key::Decimals, &(decimals as i128));
        e.storage().instance().set(&Key::Name, &name);
        e.storage().instance().set(&Key::Symbol, &symbol);
    }

    pub fn set_admin(e: Env, current_admin: Address, new_admin: Address) {
        let a = read_admin(&e);
        if a != current_admin { panic!("not admin"); }
        current_admin.require_auth();
        e.storage().instance().set(&Key::Admin, &new_admin);
    }

    pub fn balance(e: Env, owner: Address) -> i128 {
        get_balance(&e, &owner)
    }

    pub fn transfer(e: Env, from: Address, to: Address, amount: i128) {
        if amount <= 0 { panic!("bad amount"); }
        from.require_auth();
        let fb = get_balance(&e, &from);
        if fb < amount { panic!("insufficient"); }
        set_balance(&e, &from, fb - amount);
        let tb = get_balance(&e, &to);
        set_balance(&e, &to, tb + amount);
    }

    pub fn mint(e: Env, to: Address, amount: i128) {
        if amount <= 0 { panic!("bad amount"); }
        let admin = read_admin(&e);
        admin.require_auth();
        let tb = get_balance(&e, &to);
        set_balance(&e, &to, tb + amount);
    }
}
