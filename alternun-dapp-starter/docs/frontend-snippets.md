# Frontend Snippets (Angular)

## wallet.service.ts (Freighter)
```ts
import { Injectable } from '@angular/core';
import * as Freighter from '@stellar/freighter-api';

@Injectable({ providedIn: 'root' })
export class WalletService {
  async isInstalled() { return await Freighter.isConnected(); }
  async connect() { return await Freighter.requestAccess(); }
  async getPublicKey() { return await Freighter.getPublicKey(); }
  async signTx(xdr: string, network: string) {
    return await Freighter.signTransaction(xdr, { network });
  }
}
```

## soroban.service.ts (contract calls)
```ts
import { Injectable } from '@angular/core';
import { Contract, SorobanRpc, Server, xdr, Address } from '@stellar/stellar-sdk';

@Injectable({ providedIn: 'root' })
export class SorobanService {
  server = new SorobanRpc.Server(
    (import.meta as any).env?.NG_APP_SOROBAN_RPC || 'https://soroban-testnet.stellar.org:443',
    { allowHttp: false }
  );

  async invoke(contractId: string, method: string, args: xdr.ScVal[], source: string) {
    const contract = new Contract(contractId);
    // Build and simulate as per SDK docs; submit via Freighter
    // Placeholder for demo purposes.
    return { ok: true };
  }
}
```