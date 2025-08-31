import {
  Address,
  BASE_FEE,
  Contract,
  Networks,
  Operation,
  SorobanRpc,
  Transaction,
  TransactionBuilder,
  scValToNative,
  nativeToScVal,
} from "@stellar/stellar-sdk";
import * as Freighter from "@stellar/freighter-api";

// ====== helpers comunes ======
function server(rpcUrl: string) {
  return new SorobanRpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") });
}

async function loadAccount(srv: SorobanRpc.Server, account: string) {
  return await srv.getAccount(account);
}

function scAddr(a: string) {
  return Address.fromString(a).toScAddress();
}

// Construye op de contrato
function contractCall(contractId: string, fn: string, ...args: any[]) {
  const c = new Contract(contractId);
  return c.call(fn, ...args);
}

// Simula lectura (read-only) y regresa retval nativo
async function simulateRead(opts: {
  rpcUrl: string;
  networkPassphrase: string;
  contractId: string;
  fn: string;
  args: any[];
  source: string;
}) {
  const srv = server(opts.rpcUrl);
  const sourceAcc = await loadAccount(srv, opts.source);
  const op = contractCall(opts.contractId, opts.fn, ...opts.args);
  const tx = new TransactionBuilder(sourceAcc, {
    fee: BASE_FEE,
    networkPassphrase: opts.networkPassphrase,
  })
    .addOperation(op)
    .setTimeout(30)
    .build();

  const sim = await srv.simulateTransaction(tx);
  if (SorobanRpc.isSimulationError(sim)) {
    throw new Error(sim.error);
  }
  const ret = sim.result?.retval;
  if (!ret) throw new Error("Simulación sin retval");
  return scValToNative(ret);
}

// Prepara, firma con Freighter y envía
async function signAndSend(opts: {
  rpcUrl: string;
  networkPassphrase: string;
  tx: Transaction;
}) {
  const srv = server(opts.rpcUrl);
  const sim = await srv.simulateTransaction(opts.tx);
  if (SorobanRpc.isSimulationError(sim)) {
    throw new Error(sim.error);
  }
  const prepared = await srv.prepareTransaction(opts.tx, sim); // Transaction
  const signedXdr = await Freighter.signTransaction(prepared.toXDR(), { networkPassphrase: opts.networkPassphrase });
  const signedTx = TransactionBuilder.fromXDR(signedXdr, opts.networkPassphrase);
  const send = await srv.sendTransaction(signedTx);
  if (send.errorResult) {
    throw new Error(`sendTransaction failed: ${send.errorResult}`);
  }
  return send.hash!;
}

// Construye un tx de invocación de contrato (una sola operación)
async function buildInvokeTx(opts: {
  rpcUrl: string;
  networkPassphrase: string;
  source: string;          // cuenta que paga fees y (si aplica) autoriza
  contractId: string;
  fn: string;
  args: any[];
}) {
  const srv = server(opts.rpcUrl);
  const sourceAcc = await loadAccount(srv, opts.source);
  const op = contractCall(opts.contractId, opts.fn, ...opts.args);
  const tx = new TransactionBuilder(sourceAcc, {
    fee: BASE_FEE,
    networkPassphrase: opts.networkPassphrase,
  })
    .addOperation(op)
    .setTimeout(120)
    .build();
  return tx;
}

// ====== LECTURAS ======

export async function readTokenBalanceRPC(params: {
  rpcUrl: string;
  networkPassphrase: string;
  tokenId: string;
  owner: string;   // G...
  source: string;  // G... para simular
}): Promise<bigint> {
  const v = await simulateRead({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    contractId: params.tokenId,
    fn: "balance",
    args: [nativeToScVal(scAddr(params.owner), { type: "address" })],
    source: params.source,
  });
  return BigInt(v);
}

export async function readVaultTotalLockedRPC(params: {
  rpcUrl: string;
  networkPassphrase: string;
  vaultId: string;
  source: string;
}): Promise<bigint> {
  const v = await simulateRead({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    contractId: params.vaultId,
    fn: "total_locked",
    args: [],
    source: params.source,
  });
  return BigInt(v);
}

export async function readOraclePriceRPC(params: {
  rpcUrl: string;
  networkPassphrase: string;
  oracleId: string;
  source: string;
}): Promise<bigint> {
  const v = await simulateRead({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    contractId: params.oracleId,
    fn: "get_price",
    args: [],
    source: params.source,
  });
  return BigInt(v);
}

// ====== PREVIEW MINT ======

export async function previewMintRPC(params: {
  rpcUrl: string;
  networkPassphrase: string;
  minterId: string;
  amountStable1e7: bigint;
  maxIdInclusive: number;
  source: string;
}): Promise<{
  gbt_out_gm: bigint;
  net_stable_1e7: bigint;
  fee_stable_1e7: bigint;
  price_1e7: bigint;
  meets_min: boolean;
  capacity_left_gm: bigint;
}> {
  const res: any = await simulateRead({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    contractId: params.minterId,
    fn: "preview_mint",
    args: [
      nativeToScVal(params.amountStable1e7, { type: "i128" }),
      nativeToScVal(params.maxIdInclusive, { type: "u32" }),
    ],
    source: params.source,
  });
  // scValToNative ya devuelve BigInt/bool en los campos
  return {
    gbt_out_gm: BigInt(res.gbt_out_gm),
    net_stable_1e7: BigInt(res.net_stable_1e7),
    fee_stable_1e7: BigInt(res.fee_stable_1e7),
    price_1e7: BigInt(res.price_1e7),
    meets_min: !!res.meets_min,
    capacity_left_gm: BigInt(res.capacity_left_gm),
  };
}

// ====== MINT (enviar tx) ======

export async function mintGBTWithFreighter(params: {
  rpcUrl: string;
  networkPassphrase: string;
  minterId: string;
  payer: string;                // G...
  amountStable1e7: bigint;      // en 1e7 (USD)
  maxMineIdInclusive: number;   // u32
}): Promise<string> {
  // Build tx con el payer como source (firma de payer será requerida por el contrato)
  const tx = await buildInvokeTx({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    source: params.payer,
    contractId: params.minterId,
    fn: "mint",
    args: [
      nativeToScVal(scAddr(params.payer), { type: "address" }),
      nativeToScVal(params.amountStable1e7, { type: "i128" }),
      nativeToScVal(params.maxMineIdInclusive, { type: "u32" }),
    ],
  });
  // Prepara, firma con Freighter (con la cuenta conectada) y envía
  const hash = await signAndSend({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    tx,
  });
  return hash;
}

// ====== VAULT: deposit & withdraw ======

export async function depositVaultWithFreighter(params: {
  rpcUrl: string;
  networkPassphrase: string;
  vaultId: string;
  tokenGbtId: string;
  from: string;      // G...
  amount: bigint;    // unidades GBT (7 dec)
}): Promise<string> {
  // firma from
  const tx = await buildInvokeTx({
    rpcUrl: params.rpcUrl,
    networkPassphrase: params.networkPassphrase,
    source: params.from,
    contractId: params.vaultId,
    fn: "deposit",
    args: [
      nativeToScVal(scAddr(params.tokenGbtId), { type: "address" }),
      nativeToScVal(scAddr(params.from), { type: "address" }),
      nativeToScVal(params.amount, { type: "i128" }),
    ],
  });
  return await signAndSend({ rpcUrl: params.rpcUrl, networkPassphrase: params.networkPassphrase, tx });
}

export async function withdrawVaultWithFreighter(params: {
  rpcUrl: string;
  networkPassphrase: string;
  vaultId: string;
  tokenGbtId: string;
  admin: string;     // G... (admin del vault)
  to: string;        // G... receptor
  amount: bigint;    // unidades GBT (7 dec)
}): Promise<string> {
  // probamos admin_withdraw -> withdraw_to -> withdraw
  const tryFns = [
    { fn: "admin_withdraw", args: [
      nativeToScVal(scAddr(params.tokenGbtId), { type: "address" }),
      nativeToScVal(scAddr(params.admin), { type: "address" }),
      nativeToScVal(scAddr(params.to), { type: "address" }),
      nativeToScVal(params.amount, { type: "i128" }),
    ]},
    { fn: "withdraw_to", args: [
      nativeToScVal(scAddr(params.tokenGbtId), { type: "address" }),
      nativeToScVal(scAddr(params.to), { type: "address" }),
      nativeToScVal(params.amount, { type: "i128" }),
    ]},
    { fn: "withdraw", args: [
      nativeToScVal(scAddr(params.tokenGbtId), { type: "address" }),
      nativeToScVal(scAddr(params.admin), { type: "address" }),
      nativeToScVal(scAddr(params.to), { type: "address" }),
      nativeToScVal(params.amount, { type: "i128" }),
    ]},
  ] as const;

  let lastErr: any = null;
  for (const cand of tryFns) {
    try {
      const tx = await buildInvokeTx({
        rpcUrl: params.rpcUrl,
        networkPassphrase: params.networkPassphrase,
        source: params.admin,
        contractId: params.vaultId,
        fn: cand.fn,
        args: cand.args,
      });
      return await signAndSend({ rpcUrl: params.rpcUrl, networkPassphrase: params.networkPassphrase, tx });
    } catch (e: any) {
      lastErr = e;
      // sigue probando siguiente nombre
    }
  }
  throw new Error(`Ninguna función de retiro encontrada en el vault (probar: admin_withdraw / withdraw_to / withdraw). Detalle: ${lastErr}`);
}
