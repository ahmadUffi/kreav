import { api } from "./client";
import { mapWalletTx, parseMoney } from "./mappers";
import type {
  ConnectWalletBody,
  WalletBalanceRaw,
  WalletConnectionRaw,
  WalletTxResponseRaw,
  WalletView,
} from "./types";

export async function getBalance(address: string): Promise<{
  address: string;
  balance: number;
  hasUsdcTrustline: boolean;
  accountExists: boolean;
}> {
  const raw = await api.get<WalletBalanceRaw>("/wallet/balance", { address });
  return {
    address: raw.address,
    balance: parseMoney(raw.balanceUsd),
    hasUsdcTrustline: raw.hasUsdcTrustline,
    accountExists: raw.accountExists,
  };
}

export async function getTransactions(address: string, page = 1, limit = 20) {
  const raw = await api.get<WalletTxResponseRaw>("/wallet/transactions", { address, page, limit });
  return {
    items: raw.transactions.map(mapWalletTx),
    total: raw.total,
    page: raw.page,
    limit: raw.limit,
  };
}

/** Combined balance + recent transactions for the wallet dashboard. */
export async function getWallet(address: string): Promise<WalletView> {
  const [balance, tx] = await Promise.all([getBalance(address), getTransactions(address)]);
  return {
    balance: balance.balance,
    currency: "USDC",
    address: balance.address,
    hasUsdcTrustline: balance.hasUsdcTrustline,
    accountExists: balance.accountExists,
    transactions: tx.items,
  };
}

export async function connectWallet(body: ConnectWalletBody): Promise<WalletConnectionRaw> {
  return api.post<WalletConnectionRaw>("/wallets", body);
}
