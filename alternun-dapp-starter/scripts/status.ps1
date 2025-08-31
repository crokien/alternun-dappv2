$cfgPath = "C:\alternun-soroban\alternun-dapp-starter\alternun.testnet.json"
$cfg = Get-Content $cfgPath | ConvertFrom-Json

$PAYER   = $cfg.admin
$STABLE  = $cfg.contracts.stable_token
$GBT     = $cfg.contracts.gbt_token
$MINTER  = $cfg.contracts.gbt_minting
$TREAS   = $cfg.contracts.treasury
$CURVE   = $cfg.contracts.atn_bonding_curve
$ATN     = $cfg.contracts.atn_token
$VAULT   = $cfg.contracts.project_vault

# Pools P/R/A (G-addresses)
$POOL_P = "GCLLMET3GXKQ3ZVTWLRXEBXKAQYVYBPE5RMWRB23IAUOP7TX3LELWK6F"
$POOL_R = "GAIITPU3R3T3UKSJDIKHIHGKSNLWMSS33BKONBOWHDAV3S3MXEVF55I6"
$POOL_A = "GCAWYNEBWWXBNH2RARYCIVY6VBO456H2Y2AMTFCF6WGBHPEAK5ZKBUYN"

Write-Host "=== ALTERNUN STATUS (testnet) ==="
Write-Host "Admin:" $PAYER
Write-Host "Contracts -> Minter:" $MINTER ", Treasury:" $TREAS ", Vault:" $VAULT
Write-Host "Tokens -> GBT:" $GBT ", USDCdev:" $STABLE ", ATN:" $ATN
Write-Host ""

Write-Host "Payer GBT:" (soroban contract invoke --id $GBT --source-account alternun-admin --network testnet -- balance --owner $PAYER)
Write-Host "Payer USDCdev:" (soroban contract invoke --id $STABLE --source-account alternun-admin --network testnet -- balance --owner $PAYER)
Write-Host "Payer ATN:" (soroban contract invoke --id $ATN --source-account alternun-admin --network testnet -- balance --owner $PAYER)
Write-Host ""

Write-Host "Vault total_locked:" (soroban contract invoke --id $VAULT --source-account alternun-admin --network testnet -- total_locked)
Write-Host "Vault GBT balance:" (soroban contract invoke --id $GBT --source-account alternun-admin --network testnet -- balance --owner $VAULT)
Write-Host ""

Write-Host "Pools USDCdev -> P:" (soroban contract invoke --id $STABLE --source-account alternun-admin --network testnet -- balance --owner $POOL_P) `
          " R:" (soroban contract invoke --id $STABLE --source-account alternun-admin --network testnet -- balance --owner $POOL_R) `
          " A:" (soroban contract invoke --id $STABLE --source-account alternun-admin --network testnet -- balance --owner $POOL_A)
Write-Host ""

Write-Host "Curve reserve (USDCdev on curve):" (soroban contract invoke --id $STABLE --source-account alternun-admin --network testnet -- balance --owner $CURVE)
