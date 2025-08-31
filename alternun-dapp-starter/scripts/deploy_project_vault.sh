#!/usr/bin/env bash
set -euo pipefail
echo "Building project_vault..."
cargo build -p project_vault --release

WASM=../target/project_vault.wasm
if [ ! -f "$WASM" ]; then
  WASM=$(find ../target -name "*project_vault*.wasm" | head -n1)
fi

echo "Deploying project_vault..."
CID=$(soroban contract deploy --wasm "$WASM" --network testnet --source alternun-admin)
echo "CONTRACT_ID_PROJECT_VAULT=$CID"
