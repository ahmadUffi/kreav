/**
 * Boundary mappers: RAW backend JSON → frontend view models.
 *
 * - `parseMoney` turns the interceptor's decimal strings ("18.00") into numbers.
 * - Products carry no category/accent/emoji from the API, so we derive them
 *   deterministically from title/id (presentation-only).
 * - Order/settlement statuses collapse to the 3 states the UI shows.
 */
import type { Product } from "@/lib/mock";
import type {
  ProductRaw,
  OrderRaw,
  OrderStatus,
  OrderStatusView,
  OrderView,
  WalletTxRaw,
  WalletTxView,
  AnalyticsRaw,
  AnalyticsView,
} from "./types";

/** Decimal string → number. Tolerates already-number / null. */
export function parseMoney(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/** ISO datetime → YYYY-MM-DD for compact display. */
export function toDateOnly(iso: string): string {
  return iso ? iso.slice(0, 10) : "";
}

/* ── Presentation derivation (no category/accent/emoji from API) ──────── */
const ACCENTS = ["#FF3BFF", "#00F5FF", "#FFE600", "#FF4D00", "#0A0A0A"];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface Derived {
  category: string;
  emoji: string;
}
const CATEGORY_RULES: { test: RegExp; category: string; emoji: string }[] = [
  { test: /preset|lut|lightroom|filter/i, category: "Preset", emoji: "🎨" },
  { test: /notion|template|kit|resume|planner/i, category: "Template", emoji: "🗂️" },
  { test: /ebook|guide|book|pricing|writing/i, category: "Ebook", emoji: "📘" },
  { test: /course|class|lesson|beginner|tutorial/i, category: "Course", emoji: "🎓" },
  { test: /lo-?fi|beat|music|sound|ambient|audio|track/i, category: "Music", emoji: "🎧" },
];

export function derivePresentation(title: string): Derived {
  for (const rule of CATEGORY_RULES) {
    if (rule.test.test(title)) return { category: rule.category, emoji: rule.emoji };
  }
  return { category: "Digital", emoji: "📦" };
}

export function deriveAccent(id: string): string {
  return ACCENTS[hash(id) % ACCENTS.length];
}

/* ── Products ─────────────────────────────────────────────────────────── */
export function mapProduct(raw: ProductRaw): Product {
  const { category, emoji } = derivePresentation(raw.title);
  return {
    id: raw.id,
    title: raw.title,
    creator: raw.creator?.name ? `@${raw.creator.name}` : "@creator",
    price: parseMoney(raw.priceUsd),
    category,
    accent: deriveAccent(raw.id),
    emoji,
    description: raw.description ?? undefined,
  };
}

/** For the public-profile product list (has category, no creator/description). */
export function mapProfileProduct(
  raw: { id: string; title: string; priceUsd: string; category?: string },
  creatorHandle: string,
): Product {
  const derived = derivePresentation(raw.title);
  return {
    id: raw.id,
    title: raw.title,
    creator: creatorHandle,
    price: parseMoney(raw.priceUsd),
    category: raw.category || derived.category,
    accent: deriveAccent(raw.id),
    emoji: derived.emoji,
    description: undefined,
  };
}

/* ── Orders ───────────────────────────────────────────────────────────── */
const STATUS_MAP: Record<OrderStatus, OrderStatusView> = {
  CREATED: "Pending",
  CHECKOUT_STARTED: "Pending",
  PAYMENT_PENDING: "Pending",
  WAITING_WALLET: "Pending",
  SETTLEMENT_PENDING: "Pending",
  WITHDRAW_PENDING: "Pending",
  PAYMENT_RECEIVED: "Paid",
  SETTLED: "Paid",
  WITHDRAW_COMPLETED: "Paid",
  PAYMENT_FAILED: "Failed",
  SETTLEMENT_FAILED: "Failed",
  WITHDRAW_FAILED: "Failed",
  CANCELLED: "Failed",
};

export function mapOrderStatus(status: OrderStatus): OrderStatusView {
  return STATUS_MAP[status] ?? "Pending";
}

export function mapOrder(raw: OrderRaw): OrderView {
  return {
    id: raw.id,
    product: raw.productTitle,
    buyer: raw.buyerEmail,
    amount: parseMoney(raw.amountUsd),
    status: mapOrderStatus(raw.status),
    date: toDateOnly(raw.createdAt),
    txHash: raw.txHash,
  };
}

/* ── Wallet transactions ──────────────────────────────────────────────── */
export function mapWalletTx(raw: WalletTxRaw): WalletTxView {
  // A settlement crediting the creator's wallet is money in.
  const isCredit = raw.recipientType === "CREATOR";
  const label = raw.role
    ? `Settlement — ${raw.role}`
    : `Settlement (${raw.recipientType.toLowerCase()})`;
  return {
    id: raw.id,
    label,
    amount: parseMoney(raw.amount),
    type: isCredit ? "credit" : "debit",
    date: toDateOnly(raw.createdAt),
    explorerLink: raw.explorerLink,
  };
}

/* ── Analytics ────────────────────────────────────────────────────────── */
export function mapAnalytics(raw: AnalyticsRaw): AnalyticsView {
  return {
    totals: {
      revenueUsd: parseMoney(raw.totals.revenueUsd),
      sales: raw.totals.sales,
      activeProducts: raw.totals.activeProducts,
      pendingPayout: parseMoney(raw.totals.pendingPayout),
    },
    deltas: raw.deltas,
    revenueSeries: raw.revenueSeries.map((p) => ({ day: p.day, amount: parseMoney(p.amount) })),
    topProducts: raw.topProducts.map((t) => ({
      productId: t.productId,
      productTitle: t.productTitle,
      sales: t.sales,
      revenue: parseMoney(t.revenue),
    })),
  };
}
