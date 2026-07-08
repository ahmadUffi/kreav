/**
 * Stellar display helpers. UI-only — no SDK / network calls.
 * Wallet integration lives in components/WalletConnectPanel + lib/api/auth.
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
