import {
  isConnected,
  setAllowed,
  requestAccess,
  getAddress,
  getNetworkDetails,
} from "@stellar/freighter-api";

/**
 * Conecta Freighter y devuelve address + red.
 * - Usa getAddress() si ya está permitido
 * - Si no, llama setAllowed() y requestAccess()
 * - Verifica la passphrase esperada (Testnet)
 */
export async function connectFreighter(expectedPassphrase: string): Promise<{
  pubkey: string;
  network?: string;
  passphrase?: string;
}> {
  const conn = await isConnected();
  if (!conn || (typeof conn === "object" && "isConnected" in conn && !conn.isConnected)) {
    throw new Error("Freighter no está instalado o no está disponible en el navegador.");
  }

  // 1) Intenta address sin prompt si ya está permitido
  let addrRes = await getAddress();
  let address = addrRes?.address || "";

  // 2) Si no tenemos address, pide permiso y acceso
  if (!address) {
    await setAllowed();
    const access = await requestAccess();
    if (access?.error) {
      throw new Error(access.error as any);
    }
    address = access?.address || "";
    if (!address) throw new Error("No se pudo obtener la dirección desde Freighter.");
  }

  // 3) Red actual desde la extensión
  const details = await getNetworkDetails(); // trae network + passphrase (+ rpcUrl si está)
  if (details?.error) {
    throw new Error(details.error as any);
  }

  const passphrase = details?.networkPassphrase;
  if (passphrase && expectedPassphrase && passphrase !== expectedPassphrase) {
    throw new Error(
      `Freighter está en otra red (${details?.network}). Cambia a Testnet en la extensión.`
    );
  }

  return {
    pubkey: address,
    network: details?.network,
    passphrase,
  };
}
