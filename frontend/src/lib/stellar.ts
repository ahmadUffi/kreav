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

// Emoji + accent palette (brand colours) for a lightweight avatar. Emoji-only —
// no external image request, so it works offline and matches the design system.
const AVATAR_EMOJIS = ["🌅", "🎨", "🎧", "📚", "🪐", "🌸", "⚡", "🍭", "🦋", "🛼", "🌈", "🔮"];
const AVATAR_ACCENTS = ["#FF3BFF", "#00F5FF", "#FF4D00", "#FFE600", "#7C5CFF", "#12B886"];

/** Stable non-crypto hash of a string → non-negative int. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Avatar for a wallet/creator: uses the profile's `avatarEmoji`/`accent` when
 * present, otherwise derives a stable emoji + accent from the address so every
 * wallet gets a consistent, recognisable circle.
 */
export function avatarFor(
  address: string,
  emoji?: string | null,
  accent?: string | null,
): { emoji: string; accent: string } {
  const h = hashString(address || "kreav");
  return {
    emoji: emoji || AVATAR_EMOJIS[h % AVATAR_EMOJIS.length],
    accent: accent || AVATAR_ACCENTS[h % AVATAR_ACCENTS.length],
  };
}
