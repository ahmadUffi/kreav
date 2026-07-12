/**
 * Shared frontend view-model types.
 *
 * These are the shapes the UI components consume. RAW backend contracts live in
 * `@/lib/api/types`; the mappers in `@/lib/api/mappers` convert RAW → these views
 * (money as number, presentation fields like accent/emoji derived client-side).
 */

export interface Product {
  id: string;
  title: string;
  creator: string;
  /** Price in USD (display only). */
  price: number;
  category: string;
  /** Accent colour from the brand palette, used for the cover tile. */
  accent: string;
  emoji: string;
  /** Short marketing blurb shown on the product detail page. */
  description?: string;
}

/* ── Creator profile + public mini-site (Linktree-style) ─────────────── */

export interface CreatorLink {
  id: string;
  label: string;
  url: string;
}

export interface CreatorSocials {
  instagram?: string;
  x?: string;
  tiktok?: string;
  youtube?: string;
}

export interface CreatorProfile {
  username: string;
  displayName: string;
  bio: string;
  country: string;
  /** Emoji stand-in for an avatar image. */
  avatarEmoji: string;
  /** Brand accent for the mini-site header. */
  accent: string;
  socials: CreatorSocials;
  links: CreatorLink[];
  featuredProductIds: string[];
}
