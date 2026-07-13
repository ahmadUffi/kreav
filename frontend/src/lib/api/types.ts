/**
 * Backend response/request contract (RAW) + a few frontend view types.
 *
 * RAW types mirror the JSON the NestJS API returns — notably money fields are
 * STRINGS (global DecimalToStringInterceptor) and dates are ISO strings. Views
 * are what the UI consumes (money as number, mapped enums). Product/CreatorProfile
 * view shapes live in `@/lib/types` and are shared by all components.
 */

/* ── Enums (exact BE string values) ───────────────────────────────────── */
export type UserRole = "CREATOR" | "BUYER" | "ADMIN";
export type WalletProvider = "FREIGHTER" | "LOBSTR";
export type WithdrawalDestination = "GCASH" | "GOPAY" | "PAYNOW" | "BANK";
export type SettlementStatus = "PENDING" | "COMPLETED" | "FAILED";
export type WithdrawalStatus = "REQUESTED" | "PROCESSING" | "COMPLETED" | "FAILED";
export type OrderStatus =
  | "CREATED"
  | "CHECKOUT_STARTED"
  | "PAYMENT_PENDING"
  | "PAYMENT_RECEIVED"
  | "SETTLEMENT_PENDING"
  | "SETTLED"
  | "WITHDRAW_PENDING"
  | "WITHDRAW_COMPLETED"
  | "PAYMENT_FAILED"
  | "SETTLEMENT_FAILED"
  | "WITHDRAW_FAILED"
  | "WAITING_WALLET"
  | "CANCELLED";

/* ── Generic pagination wrapper ───────────────────────────────────────── */
export interface Paginated<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

/* ── Auth / Users ─────────────────────────────────────────────────────── */
export interface RegisterBody {
  email: string;
  name: string;
  role?: UserRole;
}
export interface AuthUserRaw {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}
/** POST /auth/challenge response (SEP-10). */
export interface ChallengeRaw {
  transaction: string;
  networkPassphrase: string;
}
/** POST /auth/verify response — session JWT + profile. */
export interface AuthSessionRaw {
  token: string;
  user: AuthUserRaw;
}
export interface UserRaw {
  id: string;
  email: string;
  name: string;
  username?: string;
  country?: string;
  bio?: string;
  avatarEmoji?: string;
  accent?: string;
  role: UserRole;
  createdAt: string;
}
export interface UpdateUserBody {
  name?: string;
  username?: string;
  country?: string;
  bio?: string;
  avatarEmoji?: string;
  accent?: string;
}
export interface CheckUsernameRaw {
  username: string;
  available: boolean;
}
export interface PublicProfileRaw {
  username: string;
  displayName: string;
  bio?: string;
  country?: string;
  avatarEmoji?: string;
  accent?: string;
  products: { id: string; title: string; priceUsd: string; category?: string }[];
  socials?: { instagram?: string; x?: string; tiktok?: string; youtube?: string };
  links?: { label: string; url: string }[];
}

/* ── Products ─────────────────────────────────────────────────────────── */
export interface ProductRaw {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string | null;
  priceUsd: string;
  status?: "ACTIVE" | "ARCHIVED";
  creatorId: string;
  createdAt: string;
  creator: { id: string; name: string };
  // Present on GET /products/:id — the ACTIVE revenue-split set (for edit hydration).
  collaborators?: CreateProductCollaborator[];
}
/** One revenue-split recipient. Shares across a product must sum to 100. */
export interface CreateProductCollaborator {
  walletAddress: string; // Stellar public key (G… 56 chars)
  role: string; // free-text: Author, Illustrator, Editor, …
  revenuePercentage: string; // "50.00"
}

export interface CreateProductBody {
  title: string;
  description?: string;
  fileUrl: string;
  priceUsd: string; // "18.00"
  // Fase 1: creatorId comes from the session JWT, not the body.
  // Optional revenue split. Omit → backend auto-adds the creator at 100%.
  collaborators?: CreateProductCollaborator[];
}

/* ── Orders ───────────────────────────────────────────────────────────── */
export interface OrderRaw {
  id: string;
  productTitle: string;
  productPrice: string;
  buyerEmail: string;
  amountUsd: string;
  status: OrderStatus;
  paymentRef?: string;
  txHash?: string;
  createdAt: string;
}
export interface SettlementRecipientRaw {
  walletAddress: string;
  recipientType: "CREATOR" | "PLATFORM" | "AFFILIATE" | "TREASURY";
  role: string;
  percentage: string;
  amount: string;
}
export interface OrderDetailRaw extends OrderRaw {
  productId: string;
  settlement?: {
    id: string;
    txHash: string;
    explorerLink: string;
    totalAmount: string;
    status: SettlementStatus;
    createdAt: string;
    recipients: SettlementRecipientRaw[];
  };
}
export interface CheckoutRaw {
  orderId: string;
}

/* ── Wallet ───────────────────────────────────────────────────────────── */
export interface WalletBalanceRaw {
  address: string;
  balanceUsd: string;
  hasUsdcTrustline: boolean;
  accountExists: boolean;
}
export interface WalletTxRaw {
  id: string;
  // Discriminates incoming settlements from outgoing withdrawals (Fase 2A).
  kind?: "SETTLEMENT" | "WITHDRAWAL";
  direction?: "credit" | "debit";
  orderId: string;
  txHash: string;
  totalAmount: string;
  amount: string;
  recipientType: "CREATOR" | "PLATFORM" | "AFFILIATE" | "TREASURY" | "";
  role: string;
  percentage: string;
  destination?: string;
  status: string;
  explorerLink: string;
  createdAt: string;
}
export interface WalletTxResponseRaw {
  address: string;
  transactions: WalletTxRaw[];
  page: number;
  limit: number;
  total: number;
}
export interface ConnectWalletBody {
  // Fase 1: creatorId comes from the session JWT, not the body.
  walletAddress: string;
  provider: WalletProvider;
}
export interface WalletConnectionRaw {
  id: string;
  creatorId: string;
  walletAddress: string;
  provider: WalletProvider;
  connectedAt: string;
}
export interface PrepareTrustlineRaw {
  xdr: string;
  networkPassphrase: string;
  createsAccount: boolean;
}
export interface SubmitTrustlineRaw {
  txHash: string;
  explorerLink: string;
}

/* ── Withdrawals ──────────────────────────────────────────────────────── */
export interface CreateWithdrawalBody {
  amount: number;
  destinationType: WithdrawalDestination;
  destinationAccount: string;
}
export interface WithdrawalReceipt {
  receiptVersion: string;
  withdrawalId: string;
  reference: string;
  status: WithdrawalStatus;
  amount: number;
  availableBalanceBefore: number;
  availableBalanceAfter: number;
  destinationType: string;
  destinationAccount: string;
  anchor: string;
  requestedAt: string;
  completedAt: string | null;
  settlementTxHash: string;
  settlementExplorerUrl: string;
  simulation: {
    mode: string;
    message: string;
    realComponents: string[];
    simulatedComponents: string[];
  };
}
export interface WithdrawalListRaw {
  address: string;
  withdrawals: WithdrawalReceipt[];
  page: number;
  limit: number;
  total: number;
}

/* ── Analytics ────────────────────────────────────────────────────────── */
export interface AnalyticsRaw {
  totals: { revenueUsd: string; sales: number; activeProducts: number; pendingPayout: string };
  deltas: { revenue: number; sales: number; products: number; payout: number };
  revenueSeries: { day: number; amount: string }[];
  topProducts: { productId: string; productTitle: string; sales: number; revenue: string }[];
}

/* ── Site (mini-site config) ──────────────────────────────────────────── */
export interface SiteConfigRaw {
  displayName: string;
  username: string;
  bio?: string;
  avatarEmoji?: string;
  accent?: string;
  socials: { instagram?: string; x?: string; tiktok?: string; youtube?: string };
  links: { label: string; url: string }[];
  featuredProductIds: string[];
}

/* ── Frontend view types (mapped) ─────────────────────────────────────── */
export type OrderStatusView = "Paid" | "Pending" | "Failed";

export interface OrderView {
  id: string;
  product: string;
  buyer: string;
  amount: number;
  status: OrderStatusView;
  date: string; // YYYY-MM-DD
  txHash?: string;
}

export interface WalletTxView {
  id: string;
  label: string;
  amount: number;
  type: "credit" | "debit";
  date: string;
  explorerLink?: string;
}

export interface WalletView {
  balance: number;
  currency: string;
  address: string;
  hasUsdcTrustline: boolean;
  accountExists: boolean;
  transactions: WalletTxView[];
}

export interface AnalyticsView {
  totals: { revenueUsd: number; sales: number; activeProducts: number; pendingPayout: number };
  deltas: { revenue: number; sales: number; products: number; payout: number };
  revenueSeries: { day: number; amount: number }[];
  topProducts: { productId: string; productTitle: string; sales: number; revenue: number }[];
}
