/**
 * Transaction building, submission, and polling.
 *
 * Orchestrates the canonical Soroban invoke lifecycle:
 *   build → simulate → assemble → sign → submit → poll → parse
 *
 * @see docs/architecture/Sequence-Diagram-Bible.md §24 (Contract Invocation)
 * @see docs/stellar/Stellar-Standards-PRD.md §7 (Soroban RPC)
 */

import {
  Address,
  Contract,
  Keypair,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import type { AppConfig, Recipient, SettleResult, TransactionHash } from '../types/index.js';
import { createContract, createServer } from './client.js';
import { parseSettlementEvents } from './events.js';

// ─────────────────────────────────────────────────────────────────────────────
// scVal builders
// ─────────────────────────────────────────────────────────────────────────────

function recipientToScVal(r: Recipient): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('address'),
      val: new Address(r.address).toScVal(),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('share_bps'),
      val: nativeToScVal(r.shareBps, { type: 'i128' }),
    }),
  ]);
}

/** Convert an array of Recipients to an xdr.ScVal vec. */
export function recipientsToScVal(recipients: Recipient[]): xdr.ScVal {
  return xdr.ScVal.scvVec(recipients.map(recipientToScVal));
}

// ─────────────────────────────────────────────────────────────────────────────
// Invocation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Invoke the `settle` function on the deployed Kreav contract.
 *
 * Steps:
 *   1. Build the transaction with 3 args: order_ref, total_amount, recipients
 *   2. Simulate (mandatory — never submit unsimulated)
 *   3. Assemble with resource footprint
 *   4. Sign with platform key
 *   5. Submit via sendTransaction
 *   6. Poll getTransaction until confirmed
 *   7. Parse events and return SettleResult
 */
export async function settleOrder(
  server: rpc.Server,
  config: AppConfig,
  signer: Keypair,
  orderRef: string,
  totalAmount: bigint,
  recipients: Recipient[],
): Promise<SettleResult> {
  const contract = createContract(config);
  const sourceAccount = await server.getAccount(signer.publicKey());

  // ── Step 1: Build ────────────────────────────────────────────────
  const tx = new TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase: config.network.passphrase,
  })
    .addOperation(
      contract.call(
        'settle',
        xdr.ScVal.scvString(orderRef),
        nativeToScVal(totalAmount, { type: 'i128' }),
        recipientsToScVal(recipients),
      ),
    )
    .setTimeout(30)
    .build();

  // ── Step 2: Prepare (simulate + assemble in one call) ──────────
  let prepared;
  try {
    prepared = await server.prepareTransaction(tx);
  } catch (err: any) {
    throw new Error(`settle simulation failed: ${err.message ?? String(err)}`);
  }

  // ── Step 3: Sign ─────────────────────────────────────────────────
  prepared.sign(signer);

  // ── Step 5: Submit ───────────────────────────────────────────────
  const sendResponse = await server.sendTransaction(prepared);
  if (sendResponse.status === 'PENDING' || sendResponse.status === 'DUPLICATE') {
    const hash = sendResponse.hash;

    // ── Step 6: Poll ────────────────────────────────────────────────
    const receipt = await pollTransaction(server, hash);
    if (!receipt) {
      throw new Error(`Transaction ${hash} not confirmed after polling`);
    }
    if (receipt.status === 'FAILED') {
      const errorStr = receipt.resultXdr ? JSON.stringify(receipt.resultXdr) : 'unknown error';
      throw new Error(`Transaction ${hash} FAILED on-chain: ${errorStr}`);
    }

    // ── Step 7: Parse events ────────────────────────────────────────
    const { settlementEvent, recipientEvents } = parseSettlementEvents(receipt);

    return {
      txHash: hash,
      settlementEvent,
      recipientEvents,
    };
  }

  const errorStr = sendResponse.errorResult
    ? JSON.stringify(sendResponse.errorResult)
    : sendResponse.status;
  throw new Error(`sendTransaction failed: ${errorStr}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Polling
// ─────────────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 1_000;
const MAX_POLLS = 60; // 60 seconds

/**
 * Poll `server.getTransaction(hash)` until non-NOT_FOUND.
 */
export async function pollTransaction(
  server: rpc.Server,
  hash: TransactionHash,
  maxPolls: number = MAX_POLLS,
): Promise<rpc.Api.GetTransactionResponse | null> {
  for (let i = 0; i < maxPolls; i++) {
    const result = await server.getTransaction(hash);
    if (result.status === 'NOT_FOUND') {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    return result;
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Read-only simulation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simulate a read-only contract call and return the raw return value.
 */
export async function simulateReadCall(
  config: AppConfig,
  operation: ReturnType<Contract['call']>,
): Promise<any> {
  const server = createServer(config);
  const signer = Keypair.fromSecret(config.platformSecret);
  const sourceAccount = await server.getAccount(signer.publicKey());

  const tx = new TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase: config.network.passphrase,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const simulated = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulated)) {
    throw new Error(typeof simulated.error === 'string' ? simulated.error : JSON.stringify(simulated.error));
  }
  const retval = simulated.result?.retval;
  if (!retval) {
    throw new Error('read call returned no value');
  }
  return scValToNative(retval);
}

/**
 * Simulate a contract call and return whether it succeeded or failed.
 * Used for validation-error tests where we expect rejection.
 */
export async function simulateWithExpectedFailure(
  config: AppConfig,
  operation: ReturnType<Contract['call']>,
): Promise<{ succeeded: boolean; error?: string }> {
  const server = createServer(config);
  const signer = Keypair.fromSecret(config.platformSecret);
  const sourceAccount = await server.getAccount(signer.publicKey());

  const tx = new TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase: config.network.passphrase,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const simulated = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulated)) {
    const msg = typeof simulated.error === 'string' ? simulated.error : JSON.stringify(simulated.error);
    return { succeeded: false, error: msg };
  }
  return { succeeded: true };
}
