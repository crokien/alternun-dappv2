#!/usr/bin/env bash
set -euo pipefail
echo "Building treasury..."
cargo build -p treasury --release

WASM=../target/treasury.wasm
if [ ! -f "$WASM" ]; then
  WASM=$(find ../target -name "*treasury*.wasm" | head -n1)
fi

echo "Deploying treasury..."
CID=$(soroban contract deploy --wasm "$WASM" --network testnet --source alternun-admin)
echo "CONTRACT_ID_TREASURY=$CID"
