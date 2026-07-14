import { api } from "./client";
import { mapWalletTx, parseMoney } from "./mappers";
import type {
  ConnectWalletBody,
  PrepareTrustlineRaw,
  SubmitTrustlineRaw,
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

/**
 * Sponsored USDC-trustline activation (Fase 1.5).
 *
 * The platform builds + signs the transaction and sponsors the reserve + fee;
 * the creator only co-signs in Freighter. One click, no XLM required.
 *
 *   prepare (platform-signed XDR) → Freighter sign → submit (on-chain)
 *
 * `signerAddress` is the creator's connected wallet — Freighter signs as it.
 * Throws Error with a friendly message on rejection/failure.
 */
export async function activateUsdc(signerAddress: string): Promise<SubmitTrustlineRaw> {
  const prepared = await api.post<PrepareTrustlineRaw>("/wallets/trustline/prepare", {});

  const { signTransaction } = await import("@stellar/freighter-api");
  const signed = await signTransaction(prepared.xdr, {
    networkPassphrase: prepared.networkPassphrase,
    address: signerAddress,
  });
  if (signed.error || !signed.signedTxXdr) {
    const message =
      typeof signed.error === "string"
        ? signed.error
        : ((signed.error as { message?: string } | undefined)?.message ??
          "Signing was cancelled in Freighter.");
    throw new Error(message);
  }

  return api.post<SubmitTrustlineRaw>("/wallets/trustline/submit", {
    signedXdr: signed.signedTxXdr,
  });
}
