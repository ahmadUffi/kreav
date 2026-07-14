/**
 * 07 — balances
 *
 * Read USDC balances for all relevant wallets via the SAC contract.
 * Displays raw base units and formatted USDC (7 decimals).
 *
 * Usage: npm run balances
 */

import { createLogger } from '../helpers/logger.js';
import { loadConfig } from '../helpers/config.js';
import { createServer } from '../helpers/client.js';
import { usdcBalance } from '../helpers/wallet.js';
import { formatUsdc } from '../helpers/formatter.js';

interface WalletRow {
  label: string;
  address: string;
}

async function main(): Promise<void> {
  const log = createLogger('07-balances');
  log.header('Wallet Balances');

  const config = loadConfig();
  const server = createServer(config);

  const wallets: WalletRow[] = [
    { label: 'Platform', address: config.wallets.platform },
    { label: 'Creator', address: config.wallets.creator },
    { label: 'Photographer', address: config.wallets.photographer },
    { label: 'Editor', address: config.wallets.editor },
  ];

  log.field('USDC SAC', config.usdcSac);
  log.divider();

  let grandTotalRaw = 0n;

  for (const w of wallets) {
    const raw = await usdcBalance(server, config, w.address);
    grandTotalRaw += raw;
    const formatted = formatUsdc(raw);
    const shortAddr = `${w.address.slice(0, 8)}...`;
    console.log(
      `  ${w.label.padEnd(14)} ${raw.toString().padStart(25)} base units` +
        `  =  ${formatted} USDC  ${log['kv'] ? '' : ''}` +
        `  ${'['}${shortAddr}${']'}`,
    );
  }

  log.divider();
  log.field('Grand Total', `${formatUsdc(grandTotalRaw)} USDC`);
  log.blank();
}

main().catch((err) => {
  console.error('FAILED:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
