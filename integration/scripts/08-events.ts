/**
 * 08 — events
 *
 * Read and decode on-chain events from a settlement transaction.
 * Displays SettlementExecuted and all RecipientPaid events with every decoded field.
 *
 * Usage: npm run events -- <txHash>
 *   or: npx tsx scripts/08-events.ts <txHash>
 */

import { createLogger } from '../helpers/logger.js';
import { loadConfig } from '../helpers/config.js';
import { createServer } from '../helpers/client.js';
import { pollTransaction } from '../helpers/transaction.js';
import { parseSettlementEvents } from '../helpers/events.js';
import { formatUsdc } from '../helpers/formatter.js';

async function main(): Promise<void> {
  const log = createLogger('08-events');
  log.header('Settlement Events');

  const config = loadConfig();
  const server = createServer(config);

  const txHash = process.argv[2];
  if (!txHash) {
    log.error('Missing txHash argument.');
    log.info('Usage: npm run events -- <txHash>');
    log.blank();
    process.exit(1);
  }

  log.field('Transaction', txHash);
  log.divider();

  // Fetch the transaction receipt
  const receipt = await pollTransaction(server, txHash);
  if (!receipt) {
    log.error(`Transaction ${txHash} not found after polling.`);
    process.exit(1);
  }

  if (receipt.status === 'FAILED') {
    log.error(`Transaction ${txHash} FAILED on-chain.`);
    const xdr = (receipt as any).resultXdr;
    if (xdr) log.field('Error XDR', JSON.stringify(xdr));
    process.exit(1);
  }

  // Parse events
  const { settlementEvent, recipientEvents } = parseSettlementEvents(receipt);

  // ── Display SettlementExecuted ──────────────────────────────────
  log.header('SettlementExecuted');
  log.field('Total Amount',     `${formatUsdc(settlementEvent.totalAmount)} USDC`);
  log.field('Platform Fee',     `${formatUsdc(settlementEvent.platformFeeAmount)} USDC`);
  log.field('Creator Pool',     `${formatUsdc(settlementEvent.creatorPoolAmount)} USDC`);
  log.field('Recipient Count',  String(settlementEvent.recipientCount));
  log.divider();

  // ── Display each RecipientPaid ──────────────────────────────────
  for (let i = 0; i < recipientEvents.length; i++) {
    const e = recipientEvents[i];
    console.log(`\n  RecipientPaid [${i + 1}/${recipientEvents.length}]`);
    log.field('  Wallet', e.address);
    log.field('  Amount', `${formatUsdc(e.amount)} USDC`);
  }

  // ── Sum check ───────────────────────────────────────────────────
  const totalRecipients = recipientEvents.reduce((acc, e) => acc + e.amount, 0n);
  log.divider();
  log.field('Sum of recipients', `${formatUsdc(totalRecipients)} USDC`);
  log.field('Creator pool',      `${formatUsdc(settlementEvent.creatorPoolAmount)} USDC`);

  if (totalRecipients === settlementEvent.creatorPoolAmount) {
    log.pass('Recipients sum matches creator pool');
  } else {
    log.fail('Recipients sum', `${formatUsdc(totalRecipients)} !== ${formatUsdc(settlementEvent.creatorPoolAmount)}`);
  }

  // ── Raw event count ─────────────────────────────────────────────
  const rawEventCount = ((receipt as any).events ?? []).length;
  log.field('Raw contract events', String(rawEventCount));
  log.blank();
}

main().catch((err) => {
  console.error('FAILED:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
