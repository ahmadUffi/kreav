import { api } from "./client";
import { mapWalletTx, parseMoney } from "./mappers";
import type {
  ConnectWalletBody,
  WalletBalanceRaw,
  WalletConnectionRaw,
  WalletTxResponseRaw,
  WalletView,
} from "./types";

/**
 * Wallet reads are scoped to the authenticated creator — the backend resolves
 * the connected wallet address from the session JWT (no `?address=` param).
 */
export async function getBalance(): Promise<{
  address: string;
  balance: number;
  hasUsdcTrustline: boolean;
  accountExists: boolean;
}> {
  const raw = await api.get<WalletBalanceRaw>("/wallet/balance");
  return {
    address: raw.address,
    balance: parseMoney(raw.balanceUsd),
    hasUsdcTrustline: raw.hasUsdcTrustline,
    accountExists: raw.accountExists,
  };
}

export async function getTransactions(page = 1, limit = 20) {
  const raw = await api.get<WalletTxResponseRaw>("/wallet/transactions", { page, limit });
  return {
    items: raw.transactions.map(mapWalletTx),
    total: raw.total,
    page: raw.page,
    limit: raw.limit,
  };
}

/** Combined balance + recent transactions for the wallet dashboard. */
export async function getWallet(): Promise<WalletView> {
  const [balance, tx] = await Promise.all([getBalance(), getTransactions()]);
  return {
    balance: balance.balance,
    currency: "USDC",
    address: balance.address,
    hasUsdcTrustline: balance.hasUsdcTrustline,
    accountExists: balance.accountExists,
    transactions: tx.items,
  };
}

/** Connect a wallet to the authenticated creator (identity from the JWT). */
export async function connectWallet(body: ConnectWalletBody): Promise<WalletConnectionRaw> {
  return api.post<WalletConnectionRaw>("/wallets", body);
}
