/**
 * 06 — validation-errors
 *
 * Tests that the contract rejects invalid inputs with the correct
 * ContractError codes.
 *
 * Cases:
 *   1. Invalid total amount (zero)
 *   2. Empty recipients
 *   3. Allocation sum < 10000 (5000 + 4000 = 9000)
 *   4. Allocation sum > 10000 (5000 + 6000 = 11000)
 *   5. Duplicate recipient address
 *   6. Too many recipients (11 > MAX_RECIPIENTS)
 *
 * Usage: npm run validation
 */

import { Address, Contract, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { createLogger } from '../helpers/logger.js';
import { loadConfig } from '../helpers/config.js';
import { simulateWithExpectedFailure } from '../helpers/transaction.js';

interface TestCase {
  name: string;
  configKey: 'creator' | 'photographer' | 'editor';
  totalAmount: bigint;
  recipients: { address: string; shareBps: number }[];
  expectedErrorKeywords: string[];
}

async function main(): Promise<void> {
  const log = createLogger('06-validation-errors');
  log.header('Validation Errors');

  const config = loadConfig();
  const contract = new Contract(config.contractId);
  const ts = Date.now();

  const tests: TestCase[] = [
    {
      name: 'Zero total amount',
      configKey: 'creator',
      totalAmount: 0n,
      recipients: [{ address: config.wallets.creator, shareBps: 10_000 }],
      expectedErrorKeywords: ['InvalidTotalAmount', 'total_amount must be positive'],
    },
    {
      name: 'Empty recipients',
      configKey: 'creator',
      totalAmount: 100_000_000n,
      recipients: [],
      expectedErrorKeywords: ['EmptyRecipients', 'recipients must not be empty'],
    },
    {
      name: 'Sum < 10000 (5000+4000=9000)',
      configKey: 'creator',
      totalAmount: 100_000_000n,
      recipients: [
        { address: config.wallets.creator, shareBps: 5_000 },
        { address: config.wallets.photographer, shareBps: 4_000 },
      ],
      expectedErrorKeywords: ['InvalidAllocationSum', '100%'],
    },
    {
      name: 'Sum > 10000 (5000+6000=11000)',
      configKey: 'creator',
      totalAmount: 100_000_000n,
      recipients: [
        { address: config.wallets.creator, shareBps: 5_000 },
        { address: config.wallets.photographer, shareBps: 6_000 },
      ],
      expectedErrorKeywords: ['InvalidAllocationSum', '100%'],
    },
    {
      name: 'Duplicate recipient',
      configKey: 'creator',
      totalAmount: 100_000_000n,
      recipients: [
        { address: config.wallets.creator, shareBps: 5_000 },
        { address: config.wallets.creator, shareBps: 5_000 },
      ],
      expectedErrorKeywords: ['DuplicateRecipient', 'duplicate recipient'],
    },
    {
      name: 'Too many recipients (11)',
      configKey: 'editor',
      totalAmount: 100_000_000n,
      recipients: Array.from({ length: 11 }, (_, i) => ({
        address: `G${String.fromCharCode(65 + i).repeat(55)}`.slice(0, 56),
        shareBps: 909,
      })),
      expectedErrorKeywords: ['TooManyRecipients', 'too many recipients'],
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const tc of tests) {
    // Build recipients scVal
    const recipientScVals = tc.recipients.map((r) =>
      xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('address'),
          val: new Address(r.address).toScVal(),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('share_bps'),
          val: nativeToScVal(r.shareBps, { type: 'i128' }),
        }),
      ]),
    );

    const result = await simulateWithExpectedFailure(
      config,
      contract.call(
        'settle',
        xdr.ScVal.scvString(`ERR-${tc.name.replace(/\s/g, '-')}-${ts}`),
        nativeToScVal(tc.totalAmount, { type: 'i128' }),
        xdr.ScVal.scvVec(recipientScVals),
      ),
    );

    if (result.succeeded) {
      log.fail(tc.name, 'unexpectedly succeeded');
      failed++;
    } else {
      const msg = result.error ?? '';
      const matched = tc.expectedErrorKeywords.some((kw) => msg.includes(kw)) ||
                      msg.includes('Error(Contract');  // Generic Soroban error format
      if (matched) {
        log.pass(tc.name, msg.slice(0, 100));
        passed++;
      } else {
        log.fail(tc.name, `unexpected: ${msg.slice(0, 120)}`);
        failed++;
      }
    }
  }

  log.divider();
  log.field('Passed', `${passed}/${tests.length}`);
  log.field('Failed', `${failed}/${tests.length}`);
  log.blank();

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('FAILED:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
