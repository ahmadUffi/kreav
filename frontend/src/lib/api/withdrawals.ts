import { api } from "./client";
import type { CreateWithdrawalBody, WithdrawalListRaw, WithdrawalReceipt } from "./types";

/**
 * Request a withdrawal (202 PROCESSING). Poll getWithdrawal until COMPLETED.
 * The wallet address is resolved server-side from the session JWT.
 */
export async function createWithdrawal(body: CreateWithdrawalBody): Promise<WithdrawalReceipt> {
  return api.post<WithdrawalReceipt>("/withdrawals", body);
}

export async function getWithdrawal(id: string): Promise<WithdrawalReceipt> {
  return api.get<WithdrawalReceipt>(`/withdrawals/${id}`);
}

export async function listWithdrawals(page = 1, limit = 20) {
  const raw = await api.get<WithdrawalListRaw>("/withdrawals", { page, limit });
  return { items: raw.withdrawals, total: raw.total, page: raw.page, limit: raw.limit };
}
