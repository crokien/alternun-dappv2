import { useState } from "react";
import {
  readTokenBalanceRPC,
  readVaultTotalLockedRPC,
  readOraclePriceRPC,
  previewMintRPC,
  mintGBTWithFreighter,
  depositVaultWithFreighter,
  withdrawVaultWithFreighter,
} from "./soroban";
import { connectFreighter } from "./wallet";

// ==== helpers de formateo ====
function fmtUSD1e7(v: string | number | bigint) {
  try {
    const bi = typeof v === "bigint" ? v : BigInt(String(v));
    const D = 10_000_000n; // 1e7
    const C = 100_000n;    // 1e5 (para 2 decimales)
    const dollars = bi / D;
    const cents   = (bi % D) / C; // 2 decimales
    const dStr = dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `$${dStr}.${cents.toString().padStart(2, "0")}`;
  } catch {
    const num = Number(v) / 1e7;
    return num.toLocaleString(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

// USD humano -> escala 1e7 (BigInt)
function usdTo1e7(s: string): bigint {
  const n = Number(String(s).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) throw new Error("Monto USD inválido");
  return BigInt(Math.round(n * 1e7));
}

const BPS = 10_000;
const MAX_MINE_ID = 0; // usamos la mina 0 por ahora

function App() {
  const rpcUrl = import.meta.env.VITE_RPC_URL as string;
  const networkPassphrase = import.meta.env.VITE_NETWORK_PASSPHRASE as string;

  const ADMIN   = import.meta.env.VITE_ADMIN as string;
  const GBT     = import.meta.env.VITE_GBT_TOKEN as string;
  const STABLE  = import.meta.env.VITE_STABLE_TOKEN as string;
  const VAULT   = import.meta.env.VITE_PROJECT_VAULT as string;
  const MINTER  = import.meta.env.VITE_GBT_MINTER as string;
  const ORACLE  = import.meta.env.VITE_ORACLE as string;

  // Pools P/R/A (G-addresses fijos)
  const POOL_P = "GCLLMET3GXKQ3ZVTWLRXEBXKAQYVYBPE5RMWRB23IAUOP7TX3LELWK6F";
  const POOL_R = "GAIITPU3R3T3UKSJDIKHIHGKSNLWMSS33BKONBOWHDAV3S3MXEVF55I6";
  const POOL_A = "GCAWYNEBWWXBNH2RARYCIVY6VBO456H2Y2AMTFCF6WGBHPEAK5ZKBUYN";

  const [owner, setOwner] = useState<string>(ADMIN);
  const [wallet, setWallet] = useState<string | null>(null);
  const [walletNet, setWalletNet] = useState<string | null>(null);

  const [balGBT, setBalGBT] = useState<string>("-");
  const [p, setP] = useState<string>("-");
  const [r, setR] = useState<string>("-");
  const [a, setA] = useState<string>("-");
  const [vaultGBT, setVaultGBT] = useState<string>("-");
  const [vaultTotal, setVaultTotal] = useState<string>("-");
  const [oraclePrice, setOraclePrice] = useState<string>("-");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Mint por USD (humano)
  const [amountUsd, setAmountUsd] = useState<string>("10");
  const [txHash, setTxHash] = useState<string>("");

  // Mint por gramos
  const [gramsWanted, setGramsWanted] = useState<string>("1.000");
  const [calcGross, setCalcGross] = useState<bigint | null>(null);
  const [calcPreview, setCalcPreview] = useState<null | {
    gbt_out_gm: bigint; fee_stable_1e7: bigint; net_stable_1e7: bigint; price_1e7: bigint; meets_min: boolean; capacity_left_gm: bigint;
  }>(null);

  // Deposit
  const [depAmt, setDepAmt] = useState<string>("5");
  const [depTx, setDepTx] = useState<string>("");

  // Withdraw
  const [wdAmt, setWdAmt] = useState<string>("5");
  const [wdTx, setWdTx] = useState<string>("");

  async function onConnect() {
    setErr(null);
    setLoading(true);
    try {
      const { pubkey, network } = await connectFreighter(networkPassphrase);
      setWallet(pubkey);
      setWalletNet(network ?? null);
      setOwner(pubkey);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function readOwnerGBT() {
    setErr(null);
    setLoading(true);
    try {
      const res = await readTokenBalanceRPC({
        rpcUrl, networkPassphrase,
        tokenId: GBT, owner, source: ADMIN,
      });
      setBalGBT(res.toString());
    } catch (e: any) {
      setErr(e?.message || String(e));
      setBalGBT("-");
    } finally { setLoading(false); }
  }

  async function refreshStatus() {
    setErr(null);
    setLoading(true);
    try {
      const [pB, rB, aB, vB, vT, orc] = await Promise.all([
        readTokenBalanceRPC({ rpcUrl, networkPassphrase, tokenId: STABLE, owner: POOL_P, source: ADMIN }),
        readTokenBalanceRPC({ rpcUrl, networkPassphrase, tokenId: STABLE, owner: POOL_R, source: ADMIN }),
        readTokenBalanceRPC({ rpcUrl, networkPassphrase, tokenId: STABLE, owner: POOL_A, source: ADMIN }),
        readTokenBalanceRPC({ rpcUrl, networkPassphrase, tokenId: GBT,    owner: VAULT,   source: ADMIN }),
        readVaultTotalLockedRPC({ rpcUrl, networkPassphrase, vaultId: VAULT, source: ADMIN }),
        readOraclePriceRPC({ rpcUrl, networkPassphrase, oracleId: ORACLE, source: ADMIN }),
      ]);
      setP(pB.toString());
      setR(rB.toString());
      setA(aB.toString());
      setVaultGBT(vB.toString());
      setVaultTotal(vT.toString());
      setOraclePrice(orc.toString());
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally { setLoading(false); }
  }

  // === Mint por USD ===
  async function doMintUSD() {
    setErr(null);
    setTxHash("");
    if (!wallet) { setErr("Conecta Freighter primero."); return; }
    let scaled: bigint;
    try { scaled = usdTo1e7(amountUsd); }
    catch (e: any) { setErr(e?.message || "Monto USD inválido"); return; }

    setLoading(true);
    try {
      const hash = await mintGBTWithFreighter({
        rpcUrl,
        networkPassphrase,
        minterId: MINTER,
        payer: wallet,
        amountStable1e7: scaled,     // <= ya en 1e7
        maxMineIdInclusive: MAX_MINE_ID,
      });
      setTxHash(hash);
      await readOwnerGBT();
      await refreshStatus();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally { setLoading(false); }
  }

  // === Calcular bruto desde gramos ===
  async function planFromGrams() {
    setErr(null);
    setCalcGross(null);
    setCalcPreview(null);
    const g = Number(gramsWanted.replace(",", "."));
    if (!Number.isFinite(g) || g <= 0) { setErr("Gramos inválidos."); return; }
    const gramsMilli = BigInt(Math.round(g * 1000));
    if (gramsMilli < 1000n) { setErr("Mínimo 1.000 mg (1 gramo)."); return; }

    try {
      const trialAmt = 10_000_000n; // 1 USD
      const trial = await previewMintRPC({
        rpcUrl, networkPassphrase, minterId: MINTER,
        amountStable1e7: trialAmt, maxIdInclusive: MAX_MINE_ID, source: ADMIN,
      });
      const price = trial.price_1e7;
      if (price <= 0n) throw new Error("Precio inválido (oráculo).");

      // fee_bps aproximado desde el trial
      let feeBps = Math.round(Number(trial.fee_stable_1e7 * BigInt(BPS)) / Number(trialAmt));
      if (feeBps < 0) feeBps = 0;
      if (feeBps > BPS - 1) feeBps = BPS - 1;

      // neto necesario para esos gramos: ceil(price * grams / 1000)
      const neededNet = ((price * gramsMilli) + 999n) / 1000n;
      // bruto: ceil(neededNet * BPS / (BPS - feeBps))
      const gross = ((neededNet * BigInt(BPS)) + BigInt(BPS - feeBps - 1)) / BigInt(BPS - feeBps);

      const prev = await previewMintRPC({
        rpcUrl, networkPassphrase, minterId: MINTER,
        amountStable1e7: gross, maxIdInclusive: MAX_MINE_ID, source: ADMIN,
      });

      setCalcGross(gross);
      setCalcPreview(prev);
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  // === Mint exacto tras calcular ===
  async function doMintExact() {
    if (!wallet) { setErr("Conecta Freighter primero."); return; }
    if (!calcGross || !calcPreview) { setErr("Primero pulsa 'Calcular'."); return; }
    if (!calcPreview.meets_min || calcPreview.gbt_out_gm <= 0n) { setErr("No cumple el mínimo de 1 gramo."); return; }

    setLoading(true);
    setErr(null);
    try {
      const hash = await mintGBTWithFreighter({
        rpcUrl,
        networkPassphrase,
        minterId: MINTER,
        payer: wallet,
        amountStable1e7: calcGross,  // ya en 1e7
        maxMineIdInclusive: MAX_MINE_ID,
      });
      setTxHash(hash);
      setCalcGross(null);
      setCalcPreview(null);
      await readOwnerGBT();
      await refreshStatus();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally { setLoading(false); }
  }

  // === Deposit (GBT) ===
  async function doDeposit() {
    setErr(null);
    setDepTx("");
    if (!wallet) { setErr("Conecta Freighter primero."); return; }
    const amt = parseInt(depAmt, 10);
    if (!Number.isFinite(amt) || amt <= 0) { setErr("Monto inválido."); return; }

    setLoading(true);
    try {
      const hash = await depositVaultWithFreighter({
        rpcUrl,
        networkPassphrase,
        vaultId: VAULT,
        tokenGbtId: GBT,
        from: wallet,
        amount: BigInt(amt),
      });
      setDepTx(hash);
      await readOwnerGBT();
      await refreshStatus();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally { setLoading(false); }
  }

  // === Withdraw (ADMIN) ===
  async function doWithdraw() {
    setErr(null);
    setWdTx("");
    if (!wallet) { setErr("Conecta Freighter primero."); return; }
    if (wallet !== ADMIN) { setErr("Debes conectar el ADMIN para retirar del vault."); return; }
    const amt = parseInt(wdAmt, 10);
    if (!Number.isFinite(amt) || amt <= 0) { setErr("Monto inválido."); return; }

    setLoading(true);
    try {
      const hash = await withdrawVaultWithFreighter({
        rpcUrl,
        networkPassphrase,
        vaultId: VAULT,
        tokenGbtId: GBT,
        admin: wallet,
        to: wallet,
        amount: BigInt(amt),
      });
      setWdTx(hash);
      await readOwnerGBT();
      await refreshStatus();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally { setLoading(false); }
  }

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", padding: 24, maxWidth: 940, margin: "0 auto" }}>
      <h1>Alternun — Dashboard (Testnet)</h1>
      <p><b>RPC:</b> {rpcUrl}</p>

      {/* Wallet */}
      <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h3>Wallet</h3>
        <button onClick={onConnect} disabled={loading} style={{ padding: "6px 10px" }}>
          {loading ? "..." : wallet ? "Reconnect" : "Connect Freighter"}
        </button>
        <div style={{ marginTop: 8, lineHeight: 1.5 }}>
          <div><b>Connected:</b> {wallet ?? "(no)"} {wallet === ADMIN ? "— ADMIN" : ""}</div>
          <div><b>Network:</b> {walletNet ?? "(unknown)"} — expected: Testnet</div>
        </div>
      </div>

      {/* Oracle */}
      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h3>Precio del oráculo</h3>
        <div>Escalado 1e7: <b>{oraclePrice}</b> ({fmtUSD1e7(oraclePrice)}/g)</div>
        <button onClick={refreshStatus} disabled={loading} style={{ marginTop: 8, padding: "6px 10px" }}>
          {loading ? "..." : "Refrescar (incluye oráculo)"}
        </button>
      </div>

      {/* Comprar por gramos */}
      <div style={{ marginTop: 16, padding: 12, border: "1px solid #4da3ff", borderRadius: 8, background: "#f7fbff" }}>
        <h3>Comprar GBT por gramos (3 decimales)</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span>Gramos:</span>
          <input
            type="number"
            step="0.001"
            min={1}
            value={gramsWanted}
            onChange={e => setGramsWanted(e.target.value)}
            style={{ width: 140, padding: "6px 8px" }}
          />
          <button onClick={planFromGrams} disabled={loading} style={{ padding: "6px 10px" }}>
            {loading ? "..." : "Calcular"}
          </button>
          <button onClick={doMintExact} disabled={loading || !wallet || !calcGross} style={{ padding: "6px 10px" }}>
            {loading ? "..." : "Mint exacto"}
          </button>
        </div>

        {calcGross && calcPreview && (
          <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6 }}>
            <div><b>Bruto estimado:</b> {fmtUSD1e7(calcGross)}</div>
            <div><b>GBTs estimados (g):</b> {(Number(calcPreview.gbt_out_gm) / 1000).toFixed(3)}</div>
            <div><b>Fee:</b> {fmtUSD1e7(calcPreview.fee_stable_1e7)}</div>
            <div><b>Neto:</b> {fmtUSD1e7(calcPreview.net_stable_1e7)}</div>
            <div><b>Precio:</b> {fmtUSD1e7(calcPreview.price_1e7)}/g</div>
            <div><b>Capacidad restante:</b> {(Number(calcPreview.capacity_left_gm) / 1000).toFixed(3)} g</div>
            {!calcPreview.meets_min && <div style={{ color: "crimson" }}>No cumple el mínimo (≥ 1.000 mg = 1 g).</div>}
          </div>
        )}
      </div>

      {/* Mint por USD (humano) */}
      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h3>Mint GBT (por USD)</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span>USD a usar:</span>
          <input type="number" min={1} step="0.01" value={amountUsd}
                 onChange={e => setAmountUsd(e.target.value)}
                 style={{ width: 140, padding: "6px 8px" }} />
          <button onClick={doMintUSD} disabled={loading || !wallet} style={{ padding: "6px 10px" }}>
            {loading ? "..." : "Mint"}
          </button>
        </div>
        {txHash && <div style={{ marginTop: 8, fontSize: 13 }}><b>tx:</b> {txHash}</div>}
      </div>

      {/* Deposit */}
      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h3>Depositar al Vault (GBT)</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span>GBT a depositar:</span>
          <input type="number" min={1} value={depAmt}
                 onChange={e => setDepAmt(e.target.value)}
                 style={{ width: 120, padding: "6px 8px" }} />
          <button onClick={doDeposit} disabled={loading || !wallet} style={{ padding: "6px 10px" }}>
            {loading ? "..." : "Depositar"}
          </button>
        </div>
        {depTx && <div style={{ marginTop: 8, fontSize: 13 }}><b>tx:</b> {depTx}</div>}
      </div>

      {/* Retirar (admin) */}
      <div style={{ marginTop: 16, padding: 12, border: "1px solid #f5c2c7", borderRadius: 8, background: "#fff5f5" }}>
        <h3>Retirar del Vault (ADMIN)</h3>
        <div style={{ fontSize: 12, marginBottom: 8 }}>Debes conectar el wallet <b>ADMIN</b> (VITE_ADMIN).</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span>GBT a retirar:</span>
          <input type="number" min={1} value={wdAmt}
                 onChange={e => setWdAmt(e.target.value)}
                 style={{ width: 120, padding: "6px 8px" }} />
          <button onClick={doWithdraw} disabled={loading || !wallet} style={{ padding: "6px 10px" }}>
            {loading ? "..." : "Retirar"}
          </button>
        </div>
        {wdTx && <div style={{ marginTop: 8, fontSize: 13 }}><b>tx:</b> {wdTx}</div>}
      </div>

      {/* Balance GBT del owner */}
      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h3>Balance GBT (Owner)</h3>
        <div>
          <label>
            Owner (G-address):{" "}
            <input value={owner} onChange={e => setOwner(e.target.value)} style={{ width: 560, padding: "6px 8px" }} />
          </label>
          <button onClick={readOwnerGBT} disabled={loading} style={{ marginLeft: 8, padding: "6px 10px" }}>
            {loading ? "..." : "Leer balance GBT"}
          </button>
        </div>
        <div style={{ marginTop: 10 }}>Balance: <b>{balGBT}</b></div>
      </div>

      {/* Pools & Vault */}
      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h3>Pools & Vault</h3>
        <button onClick={refreshStatus} disabled={loading} style={{ padding: "6px 10px" }}>
          {loading ? "..." : "Refrescar status"}
        </button>
        <div style={{ marginTop: 10 }}>
          <div>USDCdev P (50%): <b>{p}</b></div>
          <div>USDCdev R (30%): <b>{r}</b></div>
          <div>USDCdev A (20%): <b>{a}</b></div>
        </div>
        <div style={{ marginTop: 10 }}>
          <div>Vault GBT balance: <b>{vaultGBT}</b></div>
          <div>Vault total_locked: <b>{vaultTotal}</b></div>
        </div>
      </div>

      {err && <pre style={{ marginTop: 12, color: "crimson", whiteSpace: "pre-wrap" }}>{err}</pre>}
    </div>
  );
}

export default App;
