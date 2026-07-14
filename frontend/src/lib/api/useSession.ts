"use client";
import { useSyncExternalStore } from "react";
import { getUserId, getWalletAddress, getUsername, SESSION_EVENT } from "./session";

/**
 * Reads the MVP session from localStorage via useSyncExternalStore — SSR-safe
 * (server snapshot is null) and reactive to session writes in the same tab
 * (SESSION_EVENT) and other tabs (storage event). `ready` is false during SSR /
 * the first client render, then true, so pages can avoid flashing a signed-out
 * state before hydration.
 */
function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(SESSION_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SESSION_EVENT, callback);
  };
}

const nullSnapshot = () => null;

export function useSession() {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const userId = useSyncExternalStore(subscribe, getUserId, nullSnapshot);
  const walletAddress = useSyncExternalStore(subscribe, getWalletAddress, nullSnapshot);
  const username = useSyncExternalStore(subscribe, getUsername, nullSnapshot);

  return { ready, userId, walletAddress, username };
}
