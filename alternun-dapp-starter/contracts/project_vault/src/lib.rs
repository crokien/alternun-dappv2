#![no_std]

use soroban_sdk::{
    contract, contractimpl,
    Env, Address, Symbol,
    symbol_short,
    token::Client as TokenClient,
};

pub struct State;
impl State {
    pub const INIT: Symbol = symbol_short!("init");
    pub const ADMIN: Symbol = symbol_short!("admin");
    pub const TOTAL: Symbol = symbol_short!("total");
}

#[contract]
pub struct ProjectVault;

#[contractimpl]
impl ProjectVault {
    pub fn init(e: Env, admin: Address) {
        if e.storage().instance().has(&State::INIT) {
            return;
        }
        admin.require_auth();

        e.storage().instance().set(&State::ADMIN, &admin);
        e.storage().instance().set(&State::TOTAL, &0_i128);
        e.storage().instance().set(&State::INIT, &true);
    }

    /// Deposita GBT en el vault (transferencia desde `from` hacia `to`).
    pub fn deposit(e: Env, token_gbt: Address, from: Address, to: Address, amount: i128) {
    // Asegura la autorización del 'from' en la llamada raíz
    from.require_auth();

    // Transferencia del usuario hacia el vault (o destino indicado)
    let token_client = TokenClient::new(&e, &token_gbt);
    token_client.transfer(&from, &to, &amount);

    // Actualiza el total del vault
    let total: i128 = e.storage().instance().get(&State::TOTAL).unwrap_or(0);
    e.storage().instance().set(&State::TOTAL, &(total + amount));
}


    /// Devuelve el total bloqueado en el vault.
    pub fn total_locked(e: Env) -> i128 {
        e.storage().instance().get(&State::TOTAL).unwrap_or(0)
    }
pub fn withdraw(e: Env, admin: Address, token_gbt: Address, to: Address, amount: i128) {
    // Solo el admin del vault puede retirar
    let stored_admin: Address = e.storage().instance().get(&State::ADMIN).unwrap();
    if admin != stored_admin {
        panic!("not admin");
    }
    admin.require_auth();

    // Transferir desde el contrato (vault) hacia 'to'
    let token = TokenClient::new(&e, &token_gbt);
    token.transfer(&e.current_contract_address(), &to, &amount);

    // Actualizar el total bloqueado
    let total: i128 = e.storage().instance().get(&State::TOTAL).unwrap_or(0);
    e.storage().instance().set(&State::TOTAL, &(total - amount));
}

}
