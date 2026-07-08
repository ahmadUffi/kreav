import { api } from "./client";
import type { CreateWithdrawalBody, WithdrawalListRaw, WithdrawalReceipt } from "./types";

/** Request a withdrawal (202 PROCESSING). Poll getWithdrawal until COMPLETED. */
export async function createWithdrawal(
  address: string,
  body: CreateWithdrawalBody,
): Promise<WithdrawalReceipt> {
  return api.post<WithdrawalReceipt>("/withdrawals", body, { address });
}

export async function getWithdrawal(id: string): Promise<WithdrawalReceipt> {
  return api.get<WithdrawalReceipt>(`/withdrawals/${id}`);
}

export async function listWithdrawals(address: string, page = 1, limit = 20) {
  const raw = await api.get<WithdrawalListRaw>("/withdrawals", { address, page, limit });
  return { items: raw.withdrawals, total: raw.total, page: raw.page, limit: raw.limit };
}
