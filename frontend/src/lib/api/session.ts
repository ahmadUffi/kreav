/**
 * MVP session — the backend has no auth/login (see INTEGRATION_PLAN.md). We keep
 * the creator's `userId` and connected `walletAddress` in localStorage and thread
 * them into the `?userId=` / `?address=` query params each request needs.
 *
 * All accessors are SSR-safe (return null on the server).
 */

const USER_ID_KEY = "kreav.userId";
const WALLET_KEY = "kreav.walletAddress";
const USERNAME_KEY = "kreav.username";

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}
/** Custom event so same-tab subscribers (useSession) react to session writes. */
export const SESSION_EVENT = "kreav-session";

function write(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  if (value === null) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, value);
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export const getUserId = (): string | null => read(USER_ID_KEY);
export const setUserId = (id: string): void => write(USER_ID_KEY, id);

export const getWalletAddress = (): string | null => read(WALLET_KEY);
export const setWalletAddress = (address: string | null): void => write(WALLET_KEY, address);

export const getUsername = (): string | null => read(USERNAME_KEY);
export const setUsername = (username: string | null): void => write(USERNAME_KEY, username);

export const isSignedIn = (): boolean => getUserId() !== null;

export function clearSession(): void {
  write(USER_ID_KEY, null);
  write(WALLET_KEY, null);
  write(USERNAME_KEY, null);
}

/** Throws a friendly error when a creator-scoped call is made without a session. */
export function requireUserId(): string {
  const id = getUserId();
  if (!id) throw new Error("You need to sign in first. Create an account to continue.");
  return id;
}

export function requireWalletAddress(): string {
  const address = getWalletAddress();
  if (!address) throw new Error("Connect your Stellar wallet first to continue.");
  return address;
}
