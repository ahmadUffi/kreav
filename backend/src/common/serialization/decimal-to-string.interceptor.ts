import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Audit #10 — Decimal→JSON serializer (global interceptor).
 *
 * Prisma returns `Prisma.Decimal` for every Decimal column. NestJS serializes
 * responses with `JSON.stringify`, which invokes Decimal's own `.toJSON()` —
 * emitting the internal `{ d: [...], e: ..., s: ... }` structure instead of a
 * number. That mangles every money field in the API:
 *
 *   priceUsd: Prisma.Decimal(10)   →  { "d": [10], "e": 1, "s": 1 }   ❌
 *
 * This interceptor recursively walks the response payload and replaces each
 * Decimal with `decimal.toString()` ("10.00"), so money is always a clean
 * string in every endpoint — not just the ones that remember to `.toString()`.
 *
 * Why a global interceptor (not per-field mapping): the next tasks (BE-005
 * checkout, BE-007 settlement, BE-009 withdrawal) all return Decimals too, and
 * forgetting one field silently ships broken money to the frontend.
 */
export class DecimalToStringInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => DecimalToStringInterceptor.serialize(data)));
  }

  /**
   * Recursively convert Decimals to strings.
   * Depth-first over objects and arrays; primitives and null pass through.
   */
  private static serialize(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }
    if (value instanceof Decimal) {
      // toFixed(2), NOT toString() — toString() strips trailing zeros so
      // "10.00" → "10" and "9.50" → "9.5". Every Kreav Decimal column is
      // scale-2 (money + percentages), so two decimals is the canonical form.
      return value.toFixed(2);
    }
    if (Array.isArray(value)) {
      return value.map((item) => DecimalToStringInterceptor.serialize(item));
    }
    if (value instanceof Date) {
      // Date would also survive a typeof === 'object' check; protect it.
      return value;
    }
    if (typeof value === 'object') {
      // Build a new object rather than mutate — keeps the source immutable and
      // avoids surprises if the caller caches the original.
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        out[key] = DecimalToStringInterceptor.serialize(val);
      }
      return out;
    }
    return value;
  }
}
