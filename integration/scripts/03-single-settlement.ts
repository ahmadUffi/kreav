/**
 * 03 — single-settlement
 *
 * Full happy path: ORDER-001, 10 USDC, 1 creator at 10_000 bps (100%).
 * Verifies SettlementExecuted, RecipientPaid, and balance changes.
 *
 * Usage: npm run settle:single
 */

import { createLogger } from '../helpers/logger.js';
import { loadConfig } from '../helpers/config.js';
import { createServer, createSigner } from '../helpers/client.js';
import { settleOrder } from '../helpers/transaction.js';
import { usdcBalance } from '../helpers/wallet.js';
import { deltaUsdc } from '../helpers/formatter.js';
import { printSettlementTable } from '../helpers/events.js';
import { assertAmountEquals, creatorPoolAmount } from '../helpers/assertion.js';
import type { Recipient } from '../types/index.js';

async function main(): Promise<void> {
  const log = createLogger('03-single-settlement');
  log.header('Single Creator Settlement');

  const config = loadConfig();
  const server = createServer(config);
  const signer = createSigner(config);

  const orderRef = `ORDER-001-${Date.now()}`;
  const totalAmount = 100_000_000n; // 10 USDC
  const recipients: Recipient[] = [
    { address: config.wallets.creator, shareBps: 10_000 },
  ];

  // ── Pre-settlement balances ──────────────────────────────────────
  log.field('Reading pre-settlement balances...', '');
  const platformBefore = await usdcBalance(server, config, config.wallets.platform);
  const creatorBefore = await usdcBalance(server, config, config.wallets.creator);
  log.info(deltaUsdc('Platform', platformBefore, platformBefore));
  log.info(deltaUsdc('Creator', creatorBefore, creatorBefore));
  log.blank();

  // ── Settle ───────────────────────────────────────────────────────
  log.field('Executing settlement...', '');
  const result = await settleOrder(server, config, signer, orderRef, totalAmount, recipients);

  printSettlementTable(log, orderRef, result);

  // ── Post-settlement balances (with delay for ledger consistency) ──
  log.header('Balance Changes');
  await sleep(3000);
  const platformAfter = await usdcBalance(server, config, config.wallets.platform);
  const creatorAfter = await usdcBalance(server, config, config.wallets.creator);
  log.info(deltaUsdc('Platform', platformBefore, platformAfter));
  log.info(deltaUsdc('Creator', creatorBefore, creatorAfter));

  // ── Verify ───────────────────────────────────────────────────────
  const expectedPool = creatorPoolAmount(totalAmount);
  const creatorDelta = creatorAfter - creatorBefore;

  let allOk = true;
  allOk &&= assertAmountEquals(log, 'Platform net change', -(platformAfter - platformBefore), expectedPool);
  allOk &&= assertAmountEquals(log, 'Creator received', creatorDelta, expectedPool);

  if (result.recipientEvents.length === 1) {
    allOk &&= assertAmountEquals(log, 'RecipientPaid amount', result.recipientEvents[0].amount, expectedPool);
  } else {
    log.fail('Recipient count', `expected 1, got ${result.recipientEvents.length}`);
    allOk = false;
  }

  if (allOk) {
    log.success('Single settlement: ALL CHECKS PASSED');
  } else {
    log.error('Single settlement: SOME CHECKS FAILED');
    process.exit(1);
  }

  log.blank();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error('FAILED:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
