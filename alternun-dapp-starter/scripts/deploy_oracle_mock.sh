#!/usr/bin/env bash
set -euo pipefail
echo "Building oracle_mock..."
cargo build -p oracle_mock --release

WASM=../target/oracle_mock.wasm
if [ ! -f "$WASM" ]; then
  WASM=$(find ../target -name "*oracle_mock*.wasm" | head -n1)
fi

echo "Deploying oracle_mock..."
CID=$(soroban contract deploy --wasm "$WASM" --network testnet --source alternun-admin)
echo "CONTRACT_ID_ORACLE=$CID"
