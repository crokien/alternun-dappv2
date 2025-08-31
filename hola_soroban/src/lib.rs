#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, Env, Symbol};

#[contract]
pub struct Hola;

#[contractimpl]
impl Hola {
    pub fn ping(env: Env) -> Symbol {
        // Devuelve un Symbol corto tipo "HOLA"
        symbol_short!("HOLA")
    }
}
