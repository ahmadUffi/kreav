import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Audit #11 — HMAC webhook signature verification.
 *
 * The GCash webhook is the trigger for the entire settlement flow: without a
 * signature check, anyone who knows an orderId could POST a fake payment and
 * force a 9.50 USDC payout. Even though GCash is "mocked" for the demo, the
 * signature must be real so the security model is honest — the audit flagged a
 * bare `{ orderId, paymentRef }` body with no verification.
 *
 * Scheme: HMAC-SHA256 over the raw request body, transmitted in the
 * `X-Gcash-Signature` header, compared with a timing-safe equality check to
 * prevent timing-oracle leaks.
 *
 * The shared secret lives in `GCASH_WEBHOOK_SECRET` (env). In test/demo mode
 * without a configured secret, verification is skipped — logged as a warning —
 * so local development and CI aren't blocked. Production (and the on-stage
 * demo against real testnet funds) must set it.
 */
export class WebhookSignature {
  /**
   * @returns true if the signature is valid OR no secret is configured (dev).
   */
  static verify(
    rawBody: Buffer,
    signatureHeader: string | undefined,
    secret: string | undefined,
  ): boolean {
    // No secret configured → refuse. The controller guards the dev escape
    // hatch — this function always requires a real signature when a secret
    // is set. We never silently accept an unsigned webhook.
    if (!secret) {
      return false;
    }
    if (!signatureHeader) {
      return false;
    }

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const received = Buffer.from(signatureHeader, 'utf8');
    const wanted = Buffer.from(expected, 'utf8');

    // timingSafeEqual requires equal-length buffers; unequal length → invalid.
    if (received.length !== wanted.length) {
      return false;
    }
    return timingSafeEqual(received, wanted);
  }
}
