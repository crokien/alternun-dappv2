$PAYER    = "GBQYFSQIU2NTM2K53WZPXYWFV757KB6OK77EF4NED6DJDICBOJC7QQF6"
$STABLE   = "CBOERQKF2F3GOXUQRRONT4U5ZNT3UKE5ONYTKB6HLQNFWPNVCGJT77TY"
$MINTER   = "CAKWMCOI5M7UYVXVW62CDF2I6CWOZ2B4EGZ6ZQLXEQOPOAVVCNMJ2PAD"
$GBT      = "CD6RTLXPIOPWNRLIY535M7SVQBLEXH3DGFCAPWIUN2KMCRBI2HXMHX5L"
$POOL_P   = "GCLLMET3GXKQ3ZVTWLRXEBXKAQYVYBPE5RMWRB23IAUOP7TX3LELWK6F"
$POOL_R   = "GAIITPU3R3T3UKSJDIKHIHGKSNLWMSS33BKONBOWHDAV3S3MXEVF55I6"
$POOL_A   = "GCAWYNEBWWXBNH2RARYCIVY6VBO456H2Y2AMTFCF6WGBHPEAK5ZKBUYN"

# 1) Admin acuña 10 USDCdev al payer
soroban contract invoke --id $STABLE --source-account alternun-admin --network testnet -- mint --to $PAYER --amount 10

# 2) Payer ejecuta mint de GBT por 10
soroban contract invoke --id $MINTER --source-account alternun-admin --network testnet -- mint --payer $PAYER --amount_stable 10

# 3) Lecturas rápidas
"GBT balance (payer):"
soroban contract invoke --id $GBT --source-account alternun-admin --network testnet -- balance --owner $PAYER

"USDCdev balances P/R/A:"
soroban contract invoke --id $STABLE --source-account alternun-admin --network testnet -- balance --owner $POOL_P
soroban contract invoke --id $STABLE --source-account alternun-admin --network testnet -- balance --owner $POOL_R
soroban contract invoke --id $STABLE --source-account alternun-admin --network testnet -- balance --owner $POOL_A
