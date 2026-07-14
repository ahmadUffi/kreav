"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";

interface ThemeCtx {
  dark: boolean;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({ dark: false, toggle: () => {} });

// Theme lives in localStorage so it survives reloads. It's modelled as an
// external store (rather than useState + a localStorage-reading effect) so the
// SSR snapshot is always light and the client reads the persisted value after
// hydration — no cascading setState-in-effect, no hydration mismatch.
const KEY = "kreav-theme";
const listeners = new Set<() => void>();

function readDark(): boolean {
  try {
    return localStorage.getItem(KEY) === "dark";
  } catch {
    return false;
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function persistDark(next: boolean) {
  try {
    localStorage.setItem(KEY, next ? "dark" : "light");
  } catch {}
  listeners.forEach((l) => l());
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const dark = useSyncExternalStore(subscribe, readDark, () => false);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      dark ? "dark" : "light"
    );
  }, [dark]);

  const toggle = useCallback(() => persistDark(!readDark()), []);

  return <Ctx.Provider value={{ dark, toggle }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
