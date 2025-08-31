# Backend (Node/Express) Placeholder

Minimal scaffold to host endpoints for KYC callbacks (Sumsub), IPFS pinning, and off-chain analytics.

## Setup
```bash
pnpm i
pnpm dev
```

## Endpoints (planned)
- `POST /kyc/callback` — Sumsub webhook receiver (sandbox first).
- `POST /ipfs/pin` — Accepts files and pins to IPFS via web3.storage (token required).
- `GET  /reports/:hash` — Returns metadata for on-chain transparency hashes.