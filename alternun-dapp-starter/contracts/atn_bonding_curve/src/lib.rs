#![no_std]

use soroban_sdk::{
    contract, contractimpl,
    Env, Address, Symbol,
    symbol_short,
    token::Client as TokenClient,
};

// Claves de storage
pub struct State;
impl State {
    pub const ADMIN: Symbol     = symbol_short!("admin");
    pub const TOKEN_ATN: Symbol = symbol_short!("atn");
    pub const TOKEN_RES: Symbol = symbol_short!("res");
}

// Cliente explícito del contrato ATN para poder llamar a `mint`
mod atn_token {
    use soroban_sdk::{Env, Address, contractclient};

    #[contractclient(name = "AtnClient")]
    pub trait AtnToken {
        fn mint(e: Env, to: Address, amount: i128);
    }
}

#[contract]
pub struct AtnBondingCurve;

#[contractimpl]
impl AtnBondingCurve {
    pub fn init(e: Env, admin: Address, token_atn: Address, token_res: Address) {
        if e.storage().instance().has(&State::ADMIN) {
            return;
        }
        admin.require_auth();

        e.storage().instance().set(&State::ADMIN, &admin);
        e.storage().instance().set(&State::TOKEN_ATN, &token_atn);
        e.storage().instance().set(&State::TOKEN_RES, &token_res);
    }

    /// Compra ATN pagando con el token de reserva.
    /// Asumimos que `amount_atn` ya fue validado/limitado externamente o lo calculas
    /// con una fórmula de curva. Aquí sólo hacemos el cobro (`transfer`) y el `mint`.
    pub fn buy(e: Env, payer: Address, amount_atn: i128, cost: i128) {
        // Cargar direcciones desde storage
        let token_atn: Address = e.storage().instance().get(&State::TOKEN_ATN).unwrap();
        let token_res: Address = e.storage().instance().get(&State::TOKEN_RES).unwrap();

        // 1) Cobro del token de reserva: payer -> este contrato
        let res_client = TokenClient::new(&e, &token_res);
        payer.require_auth();
        res_client.transfer(&payer, &e.current_contract_address(), &cost);

        // 2) Mintear ATN al payer
        //    (El contrato token ATN debe ser mintable y tener como admin a este contrato)
        let atn = crate::atn_token::AtnClient::new(&e, &token_atn);
        atn.mint(&payer, &amount_atn);
    }

    // (Opcional) función auxiliar de cálculo del costo según la curva.
    // Puedes adaptar a tu fórmula real del doc de tokenomics:
    // P(s) = 0.02 + 4.95e-9 * s - 2.96e-18 * s²
    // Recuerda: implementa fixed-point (enteros) si la usas on-chain.
    pub fn quote_cost(_e: Env, amount_atn: i128) -> i128 {
        // Placeholder: 1:1 — reemplazar por la curva fixed-point
        amount_atn
    }
}
