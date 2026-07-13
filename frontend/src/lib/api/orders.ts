import { api } from "./client";
import { mapOrder, mapOrderStatus, parseMoney, toDateOnly } from "./mappers";
import type {
  CheckoutRaw,
  OrderDetailRaw,
  OrderRaw,
  OrderStatus,
  OrderStatusView,
  OrderView,
  Paginated,
} from "./types";

export interface OrderList {
  items: OrderView[];
  total: number;
  page: number;
  limit: number;
}

export interface SettlementRecipientView {
  walletAddress: string;
  type: "CREATOR" | "PLATFORM" | "AFFILIATE" | "TREASURY";
  role: string;
  percentage: string;
  amount: number;
}
export interface OrderDetailView {
  id: string;
  productId: string;
  product: string;
  amount: number;
  status: OrderStatusView;
  rawStatus: OrderStatus;
  buyer: string;
  date: string;
  txHash?: string;
  settlement?: {
    txHash: string;
    explorerLink: string;
    totalAmount: number;
    status: string;
    recipients: SettlementRecipientView[];
  };
}

/**
 * Start a checkout for a product; returns the new order id (PAYMENT_PENDING).
 * `buyerEmail` is where the product download link is sent after settlement.
 */
export async function checkout(productId: string, buyerEmail: string): Promise<string> {
  const res = await api.post<CheckoutRaw>("/checkout", { productId, buyerEmail });
  return res.orderId;
}

/**
 * Demo-only: simulate the buyer completing a local payment. The backend runs
 * the exact same confirmation path as the real PSP webhook (gated by DEMO_MODE),
 * so settlement + product delivery fire identically — no manual webhook needed.
 */
export async function simulatePayment(orderId: string): Promise<void> {
  await api.post(`/orders/${orderId}/simulate-payment`, {});
}

export async function getOrder(id: string): Promise<OrderDetailView> {
  const raw = await api.get<OrderDetailRaw>(`/orders/${id}`);
  return {
    id: raw.id,
    productId: raw.productId,
    product: raw.productTitle,
    amount: parseMoney(raw.amountUsd),
    status: mapOrderStatus(raw.status),
    rawStatus: raw.status,
    buyer: raw.buyerEmail,
    date: toDateOnly(raw.createdAt),
    txHash: raw.txHash,
    settlement: raw.settlement
      ? {
          txHash: raw.settlement.txHash,
          explorerLink: raw.settlement.explorerLink,
          totalAmount: parseMoney(raw.settlement.totalAmount),
          status: raw.settlement.status,
          recipients: raw.settlement.recipients.map((r) => ({
            walletAddress: r.walletAddress,
            type: r.recipientType,
            role: r.role,
            percentage: r.percentage,
            amount: parseMoney(r.amount),
          })),
        }
      : undefined,
  };
}

/** Orders of the authenticated creator (identity from the session JWT). */
export async function listOrders(
  params: { page?: number; limit?: number } = {},
): Promise<OrderList> {
  const res = await api.get<Paginated<OrderRaw>>("/orders", params);
  return { items: res.data.map(mapOrder), total: res.total, page: res.page, limit: res.limit };
}
