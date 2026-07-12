import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { Decimal } from '@prisma/client/runtime/library';
import { DecimalToStringInterceptor } from './decimal-to-string.interceptor';

/**
 * Audit #10 — Decimal→JSON serializer.
 * Prisma returns `Prisma.Decimal` for Decimal columns. The default JSON
 * serializer (JSON.stringify) calls `.toJSON()` on a Decimal, which returns
 * the internal `{ d: [...], e: ..., s: ... }` structure — so money fields
 * serialize to garbage like `{"d":[1,0],"e":1,"s":1}` in API responses.
 *
 * This interceptor walks the response payload and converts every Decimal to
 * its `toString()` form ("10.00") before NestJS serializes it to JSON.
 */
describe('DecimalToStringInterceptor', () => {
  let interceptor: DecimalToStringInterceptor;

  beforeEach(() => {
    interceptor = new DecimalToStringInterceptor();
  });

  // Minimal fake execution context — the interceptor doesn't read it, but
  // intercept() requires one.
  const ctx: ExecutionContext = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) }),
  } as unknown as ExecutionContext;

  it('converts a top-level Decimal to string', async () => {
    const next: CallHandler = { handle: () => of({ price: new Decimal('10.00') }) };
    const result = await lastValueFrom(interceptor.intercept(ctx, next));
    expect(result).toEqual({ price: '10.00' });
  });

  it('converts nested Decimals inside objects and arrays', async () => {
    const payload = {
      data: [
        { id: 'p1', priceUsd: new Decimal('9.50') },
        { id: 'p2', priceUsd: new Decimal('0.50') },
      ],
      total: new Decimal('10.00'),
    };
    const next: CallHandler = { handle: () => of(payload) };
    const result = (await lastValueFrom(interceptor.intercept(ctx, next))) as typeof payload;

    expect(result.data[0].priceUsd).toBe('9.50');
    expect(result.data[1].priceUsd).toBe('0.50');
    expect(result.total).toBe('10.00');
  });

  it('leaves non-Decimal primitives untouched', async () => {
    const next: CallHandler = {
      handle: () => of({ id: 'p1', title: 'Book', count: 3, active: true, none: null }),
    };
    const result = await lastValueFrom(interceptor.intercept(ctx, next));
    expect(result).toEqual({ id: 'p1', title: 'Book', count: 3, active: true, none: null });
  });

  it('handles null/undefined payloads without throwing', async () => {
    const next: CallHandler = { handle: () => of(null) };
    await expect(lastValueFrom(interceptor.intercept(ctx, next))).resolves.toBeNull();

    const nextUndef: CallHandler = { handle: () => of(undefined) };
    await expect(lastValueFrom(interceptor.intercept(ctx, nextUndef))).resolves.toBeUndefined();
  });
});
