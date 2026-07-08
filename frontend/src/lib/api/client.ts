/**
 * Axios-based client for the Kreav backend.
 *
 * - Base URL from NEXT_PUBLIC_API_URL (no global prefix on the API).
 * - A response interceptor normalizes backend errors
 *   ({ code, message, statusCode, timestamp }) into a typed `ApiError`, so the
 *   UI can show `message` and branch on `code`.
 * - The exported `api.get/post/patch/put` shape is unchanged, so the domain
 *   modules and pages keep working as-is.
 */
import axios, { AxiosError, type AxiosInstance } from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly timestamp?: string;

  constructor(code: string, message: string, statusCode: number, timestamp?: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
    this.timestamp = timestamp;
  }
}

export type QueryValue = string | number | boolean | undefined | null;
export type Query = Record<string, QueryValue>;

/** Drop undefined/null/empty params so they don't hit the wire. */
function cleanParams(query?: Query): Record<string, string> | undefined {
  if (!query) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = String(value);
  }
  return out;
}

interface BackendError {
  code?: string;
  message?: string;
  statusCode?: number;
  timestamp?: string;
}

export const http: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<BackendError>) => {
    if (error.response) {
      const data = error.response.data ?? {};
      return Promise.reject(
        new ApiError(
          data.code ?? "HTTP_ERROR",
          data.message ?? error.message ?? "Request failed",
          data.statusCode ?? error.response.status,
          data.timestamp,
        ),
      );
    }
    // No response: network down / CORS / aborted.
    return Promise.reject(
      new ApiError("NETWORK_ERROR", "Couldn't reach the server. Is the backend running?", 0),
    );
  },
);

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) =>
    http.get<T>(path, { params: cleanParams(query), signal }).then((r) => r.data),
  post: <T>(path: string, body?: unknown, query?: Query) =>
    http.post<T>(path, body, { params: cleanParams(query) }).then((r) => r.data),
  patch: <T>(path: string, body?: unknown, query?: Query) =>
    http.patch<T>(path, body, { params: cleanParams(query) }).then((r) => r.data),
  put: <T>(path: string, body?: unknown, query?: Query) =>
    http.put<T>(path, body, { params: cleanParams(query) }).then((r) => r.data),
};
