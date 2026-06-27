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
  category: "Ebook" | "Preset" | "Course" | "Music" | "Template";
  /** Accent colour from the brand palette, used for the cover tile. */
  accent: string;
  emoji: string;
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
  { id: "p1", title: "Lightroom Sunset Presets", creator: "@maya.shoots", price: 18, category: "Preset", accent: "#FF3BFF", emoji: "🌅" },
  { id: "p2", title: "Notion Creator OS", creator: "@deviantbuild", price: 29, category: "Template", accent: "#00F5FF", emoji: "🗂️" },
  { id: "p3", title: "Indie Lo-Fi Pack Vol.2", creator: "@kira.sound", price: 12, category: "Music", accent: "#FFE600", emoji: "🎧" },
  { id: "p4", title: "Freelance Pricing Ebook", creator: "@rafi.writes", price: 9, category: "Ebook", accent: "#FF4D00", emoji: "📘" },
  { id: "p5", title: "3D for Beginners", creator: "@studio.lin", price: 49, category: "Course", accent: "#FF3BFF", emoji: "🎓" },
  { id: "p6", title: "Cinematic LUT Bundle", creator: "@frame.by.frame", price: 24, category: "Preset", accent: "#00F5FF", emoji: "🎬" },
  { id: "p7", title: "Resume Template Kit", creator: "@hire.me", price: 7, category: "Template", accent: "#FFE600", emoji: "📄" },
  { id: "p8", title: "Ambient Study Beats", creator: "@kira.sound", price: 14, category: "Music", accent: "#FF4D00", emoji: "🌙" },
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
