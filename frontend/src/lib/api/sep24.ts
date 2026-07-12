import { api } from "./client";

/**
 * SEP-24 off-ramp client (Fase 2A) — talks to the Kreav backend proxy at
 * /withdrawals/anchor/*, which relays the anchor HTTP (CORS-proof). Signing is
 * non-custodial: the creator signs the SEP-10 challenge and the USDC payment in
 * Freighter here on the client. The anchor token is threaded through each call.
 *
 * Freighter is imported dynamically so this module stays SSR-safe.
 */

interface ChallengeRes {
  transaction: string;
  networkPassphrase: string;
}
interface InteractiveRes {
  url: string;
  id: string;
  withdrawalId: string;
}
export interface AnchorTxStatus {
  status: string;
  mappedStatus: "REQUESTED" | "PROCESSING" | "COMPLETED" | "FAILED";
  withdrawAnchorAccount?: string;
  withdrawMemo?: string;
  withdrawMemoType?: string;
  amountIn?: string;
  moreInfoUrl?: string;
}
interface BuildPaymentRes {
  xdr: string;
  networkPassphrase: string;
}

/** Sign an XDR in Freighter as `address`; throws a friendly error on cancel. */
async function signXdr(xdr: string, networkPassphrase: string, address: string): Promise<string> {
  const { signTransaction } = await import("@stellar/freighter-api");
  const signed = await signTransaction(xdr, { networkPassphrase, address });
  if (signed.error || !signed.signedTxXdr) {
    const message =
      typeof signed.error === "string"
        ? signed.error
        : ((signed.error as { message?: string } | undefined)?.message ??
          "Signing was cancelled in Freighter.");
    throw new Error(message);
  }
  return signed.signedTxXdr;
}

/**
 * SEP-10 against the anchor: challenge → Freighter sign → verify → anchor token.
 * The token is short-lived and used only for this withdrawal's anchor calls.
 */
export async function authenticateAnchor(walletAddress: string): Promise<string> {
  const challenge = await api.post<ChallengeRes>("/withdrawals/anchor/auth/challenge", {});
  const signedXdr = await signXdr(challenge.transaction, challenge.networkPassphrase, walletAddress);
  const { token } = await api.post<{ token: string }>("/withdrawals/anchor/auth/verify", { signedXdr });
  return token;
}

/** SEP-24: start an interactive USDC withdrawal; returns the hosted URL + ids. */
export async function startAnchorWithdrawal(token: string, amount: number): Promise<InteractiveRes> {
  return api.post<InteractiveRes>("/withdrawals/anchor/interactive", { amount, token });
}

/** SEP-24: poll a transaction's status (also persisted server-side). */
export async function pollAnchorTx(id: string, token: string): Promise<AnchorTxStatus> {
  return api.get<AnchorTxStatus>(`/withdrawals/anchor/transaction/${id}`, { token });
}

/**
 * Send the creator's USDC to the anchor once it is `pending_user_transfer_start`:
 * backend builds the payment, Freighter signs it, backend relays it. Returns the
 * on-chain tx hash.
 */
export async function sendUsdcToAnchor(
  walletAddress: string,
  id: string,
  token: string,
): Promise<string> {
  const built = await api.post<BuildPaymentRes>("/withdrawals/anchor/build-payment", { id, token });
  const signedXdr = await signXdr(built.xdr, built.networkPassphrase, walletAddress);
  const { txHash } = await api.post<{ txHash: string }>("/withdrawals/anchor/submit-payment", {
    signedXdr,
  });
  return txHash;
}
