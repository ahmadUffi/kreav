/**
 * Stellar display helpers. UI-only — no SDK / network calls. The real
 * @stellar/freighter-api integration comes later (see FE-005 scope).
 */

/** Truncate a Stellar public key for compact display, e.g. `GA1B…X9Z`. */
export function truncateAddress(address: string, lead = 4, tail = 3): string {
  if (address.length <= lead + tail + 1) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

/** Stellar.expert explorer URL for a transaction hash. */
export function stellarTxUrl(hash: string, network: "testnet" | "public" = "testnet"): string {
  return `https://stellar.expert/explorer/${network}/tx/${hash}`;
}

/** Placeholder public key used across the mocked wallet UI. */
export const MOCK_WALLET_ADDRESS = "GA1BCK2RD7QF7Q3X4M5N6P7QRSTUVWXYZ234567ABCDEFX9Z";
