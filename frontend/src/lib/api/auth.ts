import { api } from "./client";
import type { AuthSessionRaw, AuthUserRaw, ChallengeRaw, RegisterBody } from "./types";

/** Register a new account. The response includes a session JWT (`token`). */
export async function register(body: RegisterBody): Promise<AuthUserRaw & { token: string }> {
  return api.post<AuthUserRaw & { token: string }>("/auth/register", body);
}

/** SEP-10 step 1 — request a challenge transaction for a wallet address. */
export async function getChallenge(walletAddress: string): Promise<ChallengeRaw> {
  return api.post<ChallengeRaw>("/auth/challenge", { walletAddress });
}

/** SEP-10 step 2 — submit the signed challenge, receive a session JWT. */
export async function verifyChallenge(signedXdr: string): Promise<AuthSessionRaw> {
  return api.post<AuthSessionRaw>("/auth/verify", { transaction: signedXdr });
}

/**
 * Returning-creator login with Freighter (SEP-10):
 * challenge → sign in the extension → verify → session.
 *
 * Freighter is imported dynamically so this module stays SSR-safe.
 * Throws Error with a friendly message on rejection/failure.
 */
export async function loginWithFreighter(walletAddress: string): Promise<AuthSessionRaw> {
  const challenge = await getChallenge(walletAddress);

  const { signTransaction } = await import("@stellar/freighter-api");
  const signed = await signTransaction(challenge.transaction, {
    networkPassphrase: challenge.networkPassphrase,
    address: walletAddress,
  });
  if (signed.error || !signed.signedTxXdr) {
    const message =
      typeof signed.error === "string"
        ? signed.error
        : ((signed.error as { message?: string } | undefined)?.message ??
          "Signing was cancelled in Freighter.");
    throw new Error(message);
  }

  return verifyChallenge(signed.signedTxXdr);
}
