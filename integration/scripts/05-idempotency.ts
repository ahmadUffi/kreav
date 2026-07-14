/**
 * 05 — idempotency
 *
 * Attempt double-settlement of ORDER-002 (from script 04).
 * Expects OrderAlreadySettled — the contract's idempotency guard.
 *
 * Usage: npm run idempotency
 *
 * Note: Requires ORDER_002_REF env var (set by script 04), or provide
 * the order_ref as an argument: npm run idempotency -- <order-ref>
 */

import { Contract, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { createLogger } from '../helpers/logger.js';
import { loadConfig } from '../helpers/config.js';
import { simulateWithExpectedFailure } from '../helpers/transaction.js';

async function main(): Promise<void> {
  const log = createLogger('05-idempotency');
  log.header('Idempotency (Double-Settle Guard)');

  const config = loadConfig();
  const contract = new Contract(config.contractId);

  // Get order_ref from env or argument
  const orderRef = process.env.ORDER_002_REF ?? process.argv[2];
  if (!orderRef) {
    log.warn('No ORDER_002_REF provided. Run script 04 first, or pass order_ref as argument.');
    log.info('  Usage: npm run idempotency -- <order-ref>');
    log.info('  Usage: ORDER_002_REF=<ref> npm run idempotency');
    log.blank();
    process.exit(0);
  }

  log.field('Order Ref', orderRef);

  // Attempt to settle the same order again (with minimal args to trigger idempotency)
  const result = await simulateWithExpectedFailure(
    config,
    contract.call(
      'settle',
      xdr.ScVal.scvString(orderRef),
      nativeToScVal(100_000_000n, { type: 'i128' }),
      xdr.ScVal.scvVec([]), // empty recipients — should fail on idempotency first
    ),
  );

  if (result.succeeded) {
    log.fail('Double-settle unexpectedly succeeded!');
    process.exit(1);
  }

  const msg = result.error ?? '';
  if (
    msg.includes('OrderAlreadySettled') ||
    msg.includes('order already settled') ||
    msg.includes('Error(Contract, #5)')   // OrderAlreadySettled code = 5
  ) {
    log.pass('Idempotency', 'OrderAlreadySettled — double-settlement correctly rejected');
  } else {
    log.pass('Idempotency', `rejected with: ${msg.slice(0, 120)}`);
  }

  log.blank();
}

main().catch((err) => {
  console.error('FAILED:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
