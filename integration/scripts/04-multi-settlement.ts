/**
 * 04 — multi-settlement
 *
 * Multi-collaborator happy path: ORDER-002, 10 USDC, 3 recipients.
 *   Creator      5_000 (50%) → 4.7500000 USDC
 *   Photographer 3_000 (30%) → 2.8500000 USDC
 *   Editor       2_000 (20%) → 1.9000000 USDC
 *   Platform fee             0.5000000 USDC
 *
 * Usage: npm run settle:multi
 */

import { createLogger } from '../helpers/logger.js';
import { loadConfig } from '../helpers/config.js';
import { createServer, createSigner } from '../helpers/client.js';
import { settleOrder } from '../helpers/transaction.js';
import { usdcBalance } from '../helpers/wallet.js';
import { formatUsdc, deltaUsdc } from '../helpers/formatter.js';
import { printSettlementTable } from '../helpers/events.js';
import {
  assertAmountEquals,
  platformFeeAmount,
  creatorPoolAmount,
  recipientShareAmount,
  lastRecipientAmount,
} from '../helpers/assertion.js';
import type { Recipient } from '../types/index.js';

async function main(): Promise<void> {
  const log = createLogger('04-multi-settlement');
  log.header('Multi-Collaborator Settlement');

  const config = loadConfig();
  const server = createServer(config);
  const signer = createSigner(config);

  const orderRef = `ORDER-002-${Date.now()}`;
  const totalAmount = 100_000_000n; // 10 USDC

  // 3 recipients: 50% / 30% / 20% of creator pool
  const recipients: Recipient[] = [
    { address: config.wallets.creator, shareBps: 5_000 },
    { address: config.wallets.photographer, shareBps: 3_000 },
    { address: config.wallets.editor, shareBps: 2_000 },
  ];

  // ── Pre-settlement balances ──────────────────────────────────────
  log.field('Reading pre-settlement balances...', '');
  const platformBefore = await usdcBalance(server, config, config.wallets.platform);
  const creatorBefore = await usdcBalance(server, config, config.wallets.creator);
  const photoBefore = await usdcBalance(server, config, config.wallets.photographer);
  const editorBefore = await usdcBalance(server, config, config.wallets.editor);
  log.blank();

  // ── Settle ───────────────────────────────────────────────────────
  log.field('Executing multi-collaborator settlement...', '');
  const result = await settleOrder(server, config, signer, orderRef, totalAmount, recipients);

  printSettlementTable(log, orderRef, result);

  // ── Post-settlement balances ─────────────────────────────────────
  log.header('Balance Changes');
  const platformAfter = await usdcBalance(server, config, config.wallets.platform);
  const creatorAfter = await usdcBalance(server, config, config.wallets.creator);
  const photoAfter = await usdcBalance(server, config, config.wallets.photographer);
  const editorAfter = await usdcBalance(server, config, config.wallets.editor);

  log.info(deltaUsdc('Platform', platformBefore, platformAfter));
  log.info(deltaUsdc('Creator', creatorBefore, creatorAfter));
  log.info(deltaUsdc('Photographer', photoBefore, photoAfter));
  log.info(deltaUsdc('Editor', editorBefore, editorAfter));

  // ── Expected values ──────────────────────────────────────────────
  const expectedFee = platformFeeAmount(totalAmount);
  const expectedPool = creatorPoolAmount(totalAmount);
  const expectedCreatorAmt = recipientShareAmount(expectedPool, 5_000);
  const expectedPhotoAmt = recipientShareAmount(expectedPool, 3_000);
  const expectedEditorAmt = lastRecipientAmount(expectedPool, [expectedCreatorAmt, expectedPhotoAmt]);

  log.header('Expected vs Actual');
  log.field('Platform fee', `${formatUsdc(expectedFee)} USDC (5.00%)`);
  log.field('Creator pool', `${formatUsdc(expectedPool)} USDC`);
  log.field('  Creator (50%)',  `${formatUsdc(expectedCreatorAmt)} USDC`);
  log.field('  Photo   (30%)',  `${formatUsdc(expectedPhotoAmt)} USDC`);
  log.field('  Editor  (20%)',  `${formatUsdc(expectedEditorAmt)} USDC`);
  log.blank();

  // ── Verify ───────────────────────────────────────────────────────
  const creatorDelta = creatorAfter - creatorBefore;
  const photoDelta = photoAfter - photoBefore;
  const editorDelta = editorAfter - editorBefore;

  let allOk = true;
  allOk &&= assertAmountEquals(log, 'Creator amount', creatorDelta, expectedCreatorAmt);
  allOk &&= assertAmountEquals(log, 'Photographer amount', photoDelta, expectedPhotoAmt);
  allOk &&= assertAmountEquals(log, 'Editor amount', editorDelta, expectedEditorAmt);

  // Verify total distributed = creator pool
  const totalDistributed = creatorDelta + photoDelta + editorDelta;
  allOk &&= assertAmountEquals(log, 'Total distributed (= pool)', totalDistributed, expectedPool, 0n);

  // Verify platform retains fee (pays out totalAmount, gets expectedFee back)
  const platformDelta = platformAfter - platformBefore;
  const expectedPlatformDelta = -(totalAmount - expectedFee); // pays total, keeps fee
  allOk &&= assertAmountEquals(log, 'Platform net change', platformDelta, expectedPlatformDelta);

  // Verify event recipients count
  if (result.recipientEvents.length !== 3) {
    log.fail('Recipient events', `expected 3, got ${result.recipientEvents.length}`);
    allOk = false;
  }

  if (allOk) {
    log.success('Multi-collaborator settlement: ALL CHECKS PASSED');
  } else {
    log.error('Multi-collaborator settlement: SOME CHECKS FAILED');
    process.exit(1);
  }

  log.blank();
}

main().catch((err) => {
  console.error('FAILED:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
