/**
 * Static mock data for the FE-001 UI shell. No API integration — these arrays
 * stand in for future `/products`, `/orders`, and `/wallet` responses and are
 * shared between the storefront and the dashboard.
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

export interface Order {
  id: string;
  product: string;
  buyer: string;
  amount: number;
  status: "Paid" | "Pending" | "Refunded";
  date: string;
}

export interface WalletTransaction {
  id: string;
  label: string;
  amount: number;
  type: "credit" | "debit";
  date: string;
  /** On-chain Stellar transaction hash (mock) for the explorer link. */
  txHash: string;
}

export interface Wallet {
  balance: number;
  currency: string;
  transactions: WalletTransaction[];
}

export const products: Product[] = [
  { id: "p1", title: "Lightroom Sunset Presets", creator: "@maya.shoots", price: 18, category: "Preset", accent: "#FF3BFF", emoji: "🌅", description: "12 warm, film-inspired Lightroom presets tuned for golden-hour portraits and travel shots. One-click installs for desktop and mobile." },
  { id: "p2", title: "Notion Creator OS", creator: "@deviantbuild", price: 29, category: "Template", accent: "#00F5FF", emoji: "🗂️", description: "An all-in-one Notion workspace to plan content, track collabs, and manage your product launches — built for solo creators." },
  { id: "p3", title: "Indie Lo-Fi Pack Vol.2", creator: "@kira.sound", price: 12, category: "Music", accent: "#FFE600", emoji: "🎧", description: "20 royalty-free lo-fi loops and stems for streams, videos, and study playlists. WAV + MP3 included." },
  { id: "p4", title: "Freelance Pricing Ebook", creator: "@rafi.writes", price: 9, category: "Ebook", accent: "#FF4D00", emoji: "📘", description: "A no-fluff guide to pricing your freelance work with confidence — frameworks, scripts, and real rate cards." },
  { id: "p5", title: "3D for Beginners", creator: "@studio.lin", price: 49, category: "Course", accent: "#FF3BFF", emoji: "🎓", description: "A 4-hour beginner course that takes you from zero to your first rendered 3D scene. Lifetime access to all lessons." },
  { id: "p6", title: "Cinematic LUT Bundle", creator: "@frame.by.frame", price: 24, category: "Preset", accent: "#00F5FF", emoji: "🎬", description: "15 cinematic color LUTs for that filmic look in Premiere, DaVinci, and Final Cut. Works on log and rec.709 footage." },
  { id: "p7", title: "Resume Template Kit", creator: "@hire.me", price: 7, category: "Template", accent: "#FFE600", emoji: "📄", description: "3 recruiter-approved resume templates plus a cover-letter kit. Editable in Docs, Word, and Figma." },
  { id: "p8", title: "Ambient Study Beats", creator: "@kira.sound", price: 14, category: "Music", accent: "#FF4D00", emoji: "🌙", description: "A calming 1-hour ambient mix split into 12 seamless tracks — perfect for focus, sleep, and background scenes." },
];

export const orders: Order[] = [
  { id: "o1024", product: "Notion Creator OS", buyer: "@joon", amount: 29, status: "Paid", date: "2026-06-26" },
  { id: "o1023", product: "Lightroom Sunset Presets", buyer: "@aira", amount: 18, status: "Paid", date: "2026-06-25" },
  { id: "o1022", product: "Indie Lo-Fi Pack Vol.2", buyer: "@nael", amount: 12, status: "Pending", date: "2026-06-25" },
  { id: "o1021", product: "Freelance Pricing Ebook", buyer: "@sora", amount: 9, status: "Paid", date: "2026-06-24" },
  { id: "o1020", product: "3D for Beginners", buyer: "@budi", amount: 49, status: "Refunded", date: "2026-06-22" },
];

export const wallet: Wallet = {
  balance: 1284.5,
  currency: "USD",
  transactions: [
    { id: "t1", label: "Sale — Notion Creator OS", amount: 29, type: "credit", date: "2026-06-26", txHash: "a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f708192a3b4c5d6e7f8090" },
    { id: "t2", label: "Sale — Lightroom Sunset Presets", amount: 18, type: "credit", date: "2026-06-25", txHash: "b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f708192a3b4c5d6e7f8090a1" },
    { id: "t3", label: "Withdrawal to wallet", amount: 200, type: "debit", date: "2026-06-24", txHash: "c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f708192a3b4c5d6e7f8090a1b2" },
    { id: "t4", label: "Sale — Freelance Pricing Ebook", amount: 9, type: "credit", date: "2026-06-24", txHash: "d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f708192a3b4c5d6e7f8090a1b2c3" },
    { id: "t5", label: "Refund — 3D for Beginners", amount: 49, type: "debit", date: "2026-06-22", txHash: "e5f60718293a4b5c6d7e8f901a2b3c4d5e6f708192a3b4c5d6e7f8090a1b2c3d4" },
  ],
};

/* ---------------------------------------------------------------------------
   Creator dashboard analytics (mock — stands in for a future /analytics API).
--------------------------------------------------------------------------- */

export interface RevenuePoint {
  /** Day index within the trailing 30-day window (1 = oldest). */
  day: number;
  amount: number;
}

export interface TopProduct {
  productId: string;
  sales: number;
  revenue: number;
}

export interface Analytics {
  totals: { revenueUsd: number; sales: number; activeProducts: number; pendingPayout: number };
  /** % change vs the previous period, for KPI deltas. */
  deltas: { revenue: number; sales: number; products: number; payout: number };
  revenueSeries: RevenuePoint[];
  topProducts: TopProduct[];
  views: number;
}

const REVENUE_30D = [
  80, 95, 70, 110, 130, 90, 120, 140, 100, 150, 170, 130, 160, 145, 190,
  175, 210, 160, 195, 220, 180, 230, 205, 250, 215, 240, 270, 235, 280, 300,
];

export const analytics: Analytics = {
  totals: { revenueUsd: 4218, sales: 186, activeProducts: 8, pendingPayout: 312.5 },
  deltas: { revenue: 12.4, sales: 8.1, products: 0, payout: -3.2 },
  revenueSeries: REVENUE_30D.map((amount, i) => ({ day: i + 1, amount })),
  topProducts: [
    { productId: "p2", sales: 64, revenue: 1856 },
    { productId: "p1", sales: 41, revenue: 738 },
    { productId: "p6", sales: 33, revenue: 792 },
    { productId: "p5", sales: 18, revenue: 882 },
    { productId: "p3", sales: 30, revenue: 360 },
  ],
  views: 4820,
};

/* ---------------------------------------------------------------------------
   Creator profile + public mini-site (Linktree-style) — mock.
--------------------------------------------------------------------------- */

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

export const currentCreator: CreatorProfile = {
  username: "maya.shoots",
  displayName: "Maya Tan",
  bio: "Photographer & preset maker from Jakarta. I help creators get the warm, filmic look.",
  country: "Indonesia",
  avatarEmoji: "🌅",
  accent: "#FF3BFF",
  socials: { instagram: "maya.shoots", x: "mayashoots", tiktok: "maya.shoots", youtube: "@mayashoots" },
  links: [
    { id: "l1", label: "My Lightroom workflow (free)", url: "https://example.com/workflow" },
    { id: "l2", label: "Book a 1:1 editing session", url: "https://example.com/booking" },
    { id: "l3", label: "Join my newsletter", url: "https://example.com/newsletter" },
  ],
  featuredProductIds: ["p1", "p6", "p3"],
};

/* Additional creators featured on the storefront. Each maps to products above
   via the `@handle` in Product.creator, and resolves to a public mini-site
   at /u/<username>. */
const deviantBuild: CreatorProfile = {
  username: "deviantbuild",
  displayName: "Jacob Lim",
  bio: "Systems tinkerer from Manila. I build Notion workspaces that actually get used.",
  country: "Philippines",
  avatarEmoji: "🗂️",
  accent: "#00F5FF",
  socials: { x: "deviantbuild", youtube: "@deviantbuild" },
  links: [
    { id: "l1", label: "Free Notion starter kit", url: "https://example.com/notion-starter" },
    { id: "l2", label: "1:1 workspace setup call", url: "https://example.com/setup" },
  ],
  featuredProductIds: ["p2"],
};

const kiraSound: CreatorProfile = {
  username: "kira.sound",
  displayName: "Kira Nguyen",
  bio: "Lo-fi producer from Hanoi. Loops, stems and ambient beats for your streams and study sessions.",
  country: "Vietnam",
  avatarEmoji: "🎧",
  accent: "#FFE600",
  socials: { instagram: "kira.sound", tiktok: "kira.sound", youtube: "@kirasound" },
  links: [
    { id: "l1", label: "Free sample pack", url: "https://example.com/samples" },
    { id: "l2", label: "Licensing enquiries", url: "https://example.com/license" },
  ],
  featuredProductIds: ["p3", "p8"],
};

const studioLin: CreatorProfile = {
  username: "studio.lin",
  displayName: "Lin Studio",
  bio: "3D artist & educator. Teaching beginners how to render their first scene from scratch.",
  country: "Singapore",
  avatarEmoji: "🎓",
  accent: "#FF4D00",
  socials: { instagram: "studio.lin", youtube: "@studiolin" },
  links: [
    { id: "l1", label: "Watch a free lesson", url: "https://example.com/lesson" },
  ],
  featuredProductIds: ["p5"],
};

/** Lookup used by the public mini-site route and the storefront. */
export const creators: CreatorProfile[] = [currentCreator, deviantBuild, kiraSound, studioLin];
export function findCreator(username: string): CreatorProfile | undefined {
  return creators.find((c) => c.username === username);
}

/** Products sold by a given creator, matched via the `@handle` on each product. */
export function productsByCreator(username: string): Product[] {
  const handle = `@${username}`;
  return products.filter((p) => p.creator === handle);
}
