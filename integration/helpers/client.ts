/**
 * Soroban RPC client, Contract instance, and platform signer factory.
 *
 * All scripts should get their SDK objects through this module to ensure
 * consistent configuration and reuse.
 */

import { Contract, Keypair, rpc } from '@stellar/stellar-sdk';
import type { AppConfig } from '../types/index.js';

let _server: rpc.Server | null = null;
let _contract: Contract | null = null;
let _keypair: Keypair | null = null;

/** Create (or return cached) RPC server connected to the configured endpoint. */
export function createServer(config: AppConfig): rpc.Server {
  if (!_server) {
    _server = new rpc.Server(config.network.rpcUrl, { allowHttp: true });
  }
  return _server;
}

/** Create (or return cached) Contract instance for the settlement contract. */
export function createContract(config: AppConfig): Contract {
  if (!_contract) {
    _contract = new Contract(config.contractId);
  }
  return _contract;
}

/** Create (or return cached) platform Keypair from the secret seed. */
export function createSigner(config: AppConfig): Keypair {
  if (!_keypair) {
    _keypair = Keypair.fromSecret(config.platformSecret);
  }
  return _keypair;
}

/** Reset all cached instances (useful for reconnection or tests). */
export function resetClients(): void {
  _server = null;
  _contract = null;
  _keypair = null;
}
