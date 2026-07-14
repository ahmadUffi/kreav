import { createHmac } from 'node:crypto';
import { WebhookSignature } from './webhook-signature';

/**
 * Audit #11 — HMAC webhook signature verification.
 */
describe('WebhookSignature (audit #11)', () => {
  const secret = 'super-secret-key';
  const body = Buffer.from(JSON.stringify({ orderId: 'o1', paymentRef: 'r1' }));

  const sign = (payload: Buffer, key: string): string =>
    createHmac('sha256', key).update(payload).digest('hex');

  it('accepts a valid HMAC signature', () => {
    const sig = sign(body, secret);
    expect(WebhookSignature.verify(body, sig, secret)).toBe(true);
  });

  it('rejects a signature from the wrong secret', () => {
    const sig = sign(body, 'wrong-key');
    expect(WebhookSignature.verify(body, sig, secret)).toBe(false);
  });

  it('rejects a tampered body (signature no longer matches)', () => {
    const sig = sign(body, secret);
    const tampered = Buffer.from(JSON.stringify({ orderId: 'o1', paymentRef: 'EVIL' }));
    expect(WebhookSignature.verify(tampered, sig, secret)).toBe(false);
  });

  it('rejects a missing signature header when a secret is set', () => {
    expect(WebhookSignature.verify(body, undefined, secret)).toBe(false);
  });

  it('rejects a signature of different length (not just mismatched bytes)', () => {
    expect(WebhookSignature.verify(body, 'too-short', secret)).toBe(false);
  });

  it('accepts when no secret is configured (dev/CI escape hatch)', () => {
    expect(WebhookSignature.verify(body, undefined, undefined)).toBe(true);
    expect(WebhookSignature.verify(body, 'garbage', undefined)).toBe(true);
  });
});
