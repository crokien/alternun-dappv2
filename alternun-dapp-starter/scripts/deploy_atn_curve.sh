#!/usr/bin/env bash
set -euo pipefail
echo "Building atn_bonding_curve..."
cargo build -p atn_bonding_curve --release

WASM=../target/atn_bonding_curve.wasm
if [ ! -f "$WASM" ]; then
  WASM=$(find ../target -name "*atn_bonding_curve*.wasm" | head -n1)
fi

echo "Deploying atn_bonding_curve..."
CID=$(soroban contract deploy --wasm "$WASM" --network testnet --source alternun-admin)
echo "CONTRACT_ID_ATN_CURVE=$CID"
