#!/usr/bin/env bash
set -euo pipefail
echo "Building gbt_minting..."
cargo build -p gbt_minting --release

WASM=../target/gbt_minting.wasm
if [ ! -f "$WASM" ]; then
  WASM=$(find ../target -name "*gbt_minting*.wasm" | head -n1)
fi

echo "Deploying gbt_minting..."
CID=$(soroban contract deploy --wasm "$WASM" --network testnet --source alternun-admin)
echo "CONTRACT_ID_GBT_MINTING=$CID"
