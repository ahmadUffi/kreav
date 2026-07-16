"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "./client";

export interface QueryResult<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  /** Re-run the fetcher (e.g. after a mutation). */
  refetch: () => void;
}

/**
 * Generic hooks-based data fetcher for client components.
 *
 * - Runs `fetcher` on mount and whenever `deps` change, while `enabled`.
 * - `loading` is derived (no synchronous setState in the effect), so it plays
 *   nicely with React 19's stricter effect rules.
 * - `error` is the typed ApiError, so callers can read `.message` or branch on
 *   `.statusCode` (e.g. 404).
 */
export function useApiQuery<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList = [],
  enabled: boolean = true,
): QueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);

  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetcherRef
      .current()
      .then((d) => {
        if (alive) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (alive) setError(e instanceof ApiError ? e : new ApiError("UNKNOWN", "Something went wrong.", 0));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, nonce, ...deps]);

  const refetch = useCallback(() => {
    setError(null);
    setNonce((n) => n + 1);
  }, []);

  const loading = enabled && data === null && error === null;
  return { data, loading, error, refetch };
}

export interface ActionResult<Args extends unknown[], T> {
  run: (...args: Args) => Promise<T | undefined>;
  pending: boolean;
  error: ApiError | null;
  reset: () => void;
}

/**
 * Hooks-based mutation helper — wraps an async action with pending/error state.
 * Returns the action result (or undefined if it threw). Errors are also stored.
 */
export function useApiAction<Args extends unknown[], T>(
  action: (...args: Args) => Promise<T>,
): ActionResult<Args, T> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const actionRef = useRef(action);
  useEffect(() => {
    actionRef.current = action;
  });

  const run = useCallback(async (...args: Args) => {
    setPending(true);
    setError(null);
    try {
      return await actionRef.current(...args);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("UNKNOWN", "Something went wrong.", 0));
      return undefined;
    } finally {
      setPending(false);
    }
  }, []);

  const reset = useCallback(() => setError(null), []);
  return { run, pending, error, reset };
}
