/**
 * Configuration loader.
 *
 * Reads environment variables via dotenv and returns a validated AppConfig.
 * Fails fast on missing or invalid required variables.
 */

import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppConfig, NetworkConfig, StellarAddress, StellarSecret } from '../types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env');

dotenv.config({ path: envPath });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required env variable: ${name}. ` +
        `Check ${envPath} or copy from .env.example`,
    );
  }
  return value.trim();
}

const NETWORK_PASSPHRASES: Record<string, string> = {
  testnet: 'Test SDF Network ; September 2015',
  futurenet: 'Test SDF Future Network ; October 2022',
  pubnet: 'Public Global Stellar Network ; September 2015',
};

/** Load, validate, and return the typed application configuration. */
export function loadConfig(): AppConfig {
  const networkName = requireEnv('NETWORK');
  const rpcUrl = requireEnv('RPC_URL');
  const passphrase = NETWORK_PASSPHRASES[networkName];

  if (!passphrase) {
    throw new Error(
      `Unsupported network: "${networkName}". ` +
        `Use: ${Object.keys(NETWORK_PASSPHRASES).join(', ')}`,
    );
  }

  const network: NetworkConfig = { network: networkName, rpcUrl, passphrase };

  return {
    network,
    contractId: requireEnv('CONTRACT_ID') as StellarAddress,
    usdcSac: requireEnv('USDC_SAC') as StellarAddress,
    platformSecret: requireEnv('PLATFORM_SECRET') as StellarSecret,
    wallets: {
      platform: requireEnv('PLATFORM_PUBLIC') as StellarAddress,
      creator: requireEnv('CREATOR_PUBLIC') as StellarAddress,
      photographer: requireEnv('PHOTOGRAPHER_PUBLIC') as StellarAddress,
      editor: requireEnv('EDITOR_PUBLIC') as StellarAddress,
    },
  };
}
