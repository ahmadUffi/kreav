/**
 * 01 — get-version
 *
 * Reads the deployed contract's version string via a read-only simulation.
 *
 * Usage: npm run version
 *   or: npx tsx scripts/01-get-version.ts
 */

import { createLogger } from '../helpers/logger.js';
import { loadConfig } from '../helpers/config.js';
import { createContract } from '../helpers/client.js';
import { simulateReadCall } from '../helpers/transaction.js';

async function main(): Promise<void> {
  const log = createLogger('01-get-version');
  log.header('Contract Version');

  const config = loadConfig();
  const contract = createContract(config);

  log.field('Contract ID', config.contractId);
  log.field('Network', config.network.network);
  log.field('RPC URL', config.network.rpcUrl);

  const version = await simulateReadCall(
    config,
    contract.call('get_version'),
  );

  console.log(`\n  ${'Version'.padEnd(20)} "${version}"\n`);
  log.success(`get_version() returned: ${version}`);
  log.blank();
}

main().catch((err) => {
  console.error('FAILED:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
