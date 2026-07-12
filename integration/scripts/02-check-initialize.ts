/**
 * 02 — check-initialize
 *
 * Verifies the contract is properly initialized.
 * If already initialized, treats AlreadyInitialized as PASS.
 *
 * Usage: npm run initialize
 */

import { Address } from '@stellar/stellar-sdk';
import { createLogger } from '../helpers/logger.js';
import { loadConfig } from '../helpers/config.js';
import { createContract } from '../helpers/client.js';
import { simulateWithExpectedFailure } from '../helpers/transaction.js';

async function main(): Promise<void> {
  const log = createLogger('02-check-initialize');
  log.header('Check Initialization');

  const config = loadConfig();
  const contract = createContract(config);

  log.field('Platform Wallet', config.wallets.platform);
  log.field('USDC SAC', config.usdcSac);

  const result = await simulateWithExpectedFailure(
    config,
    contract.call(
      'initialize',
      new Address(config.wallets.platform).toScVal(),
      new Address(config.usdcSac).toScVal(),
    ),
  );

  if (result.succeeded) {
    log.success('initialize() succeeded — contract was uninitialized and is now ready.');
  } else {
    const msg = result.error ?? '';
    if (
      msg.includes('AlreadyInitialized') ||
      msg.includes('already initialized') ||
      msg.includes('Error(Contract, #1)') ||   // AlreadyInitialized code = 1
      msg.includes('ContractError::AlreadyInitialized')
    ) {
      log.pass('Initialize', 'contract already initialized');
    } else {
      log.fail('Initialize', `unexpected error: ${msg}`);
      process.exit(1);
    }
  }

  log.blank();
}

main().catch((err) => {
  console.error('FAILED:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
