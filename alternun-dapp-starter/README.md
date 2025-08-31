# Alternun DApp Starter (Stellar + Soroban)

Vertical slice starter for Alternun on Stellar using Soroban smart contracts.
It includes minimal contracts for:
- **GBT Minting** (accepts stablecoin, mints GBT, and routes funds to Treasury)
- **Treasury** (splits incoming funds 50/30/20 to Projects/Recovery/Alternun)
- **ATN Bonding Curve** (quotes and mints ATN against a reserve token)
- **Project Vault** (locks GBT and accounts for positions; pGBT placeholder)
- **Oracle Mock** (sets a gold price for testing)

Frontend and backend folders are placeholders with guidance and example code snippets.

---

## Prerequisites

- Rust (stable) and cargo
- Soroban CLI
- Node.js >= 18 and pnpm or npm
- Angular CLI (for the frontend): `npm i -g @angular/cli`
- Freighter wallet (for testnet interactions)

## Quick Start

### 1) Build contracts
```bash
cd contracts
cargo build -Z unstable-options --out-dir ../target --release
```

Or with Soroban CLI:
```bash
soroban contract build
```

### 2) Deploy to Testnet
Edit `.env` (copy from `.env.example`) with your secret keys and RPC URL.

Example deploy (replace with your network alias and key):
```bash
# Example network setup
soroban config network add testnet --rpc-url https://soroban-testnet.stellar.org:443 --network-passphrase "Test SDF Network ; September 2015"
soroban config identity generate alternun-admin

# Deploy contracts
./scripts/deploy_gbt_minting.sh
./scripts/deploy_treasury.sh
./scripts/deploy_atn_curve.sh
./scripts/deploy_project_vault.sh
./scripts/deploy_oracle_mock.sh
```

Each script echoes the persisted **contract IDs**. Put them into `.env` and the frontend config when you wire the UI.

### 3) Frontend (Angular) scaffold
We recommend generating Angular in this `frontend/` folder:
```bash
cd frontend
ng new alternun-dapp --routing --style=scss
cd alternun-dapp
pnpm add @stellar/freighter-api @stellar/stellar-sdk
```

Add the provided `wallet.service.ts` and `soroban.service.ts` snippets from `docs/frontend-snippets.md` to wire Freighter + contract calls.

### 4) Backend (Node/Express) scaffold
See `backend/README.md` for a minimal Express server with KYC hooks (Sumsub placeholder) and IPFS pinning stubs.

---

## Contracts Overview

- **gbt_minting**: Accepts a stablecoin payment (SAC) → quotes GBT via Oracle → mints GBT → calls Treasury to split funds.
- **treasury**: Immutable split 50/30/20 to Projects/Recovery/Alternun wallets/contracts.
- **atn_bonding_curve**: Deterministic pricing function and mint against a reserve token. Returns quotes and enforces max slippage.
- **project_vault**: Lock/unlock GBT with position accounting for future pGBT/ePT logic.
- **oracle_mock**: Admin-set price for gold (for dev/test). Replace with a real oracle later.

### Token Standards
Use Stellar's Soroban Token standard for ATN/GBT and Stellar Asset Contract (SAC) for classic assets like USDC/EURC on Soroban.

---

## Notes
- Versions in `Cargo.toml` are conservative; adjust to your installed Soroban toolchain.
- This is a starter; complete validation, events, and auth as you harden the logic.