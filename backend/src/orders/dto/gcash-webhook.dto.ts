import { IsDefined, IsString, IsUUID, Matches } from 'class-validator';

/**
 * Body for POST /webhooks/gcash — the mock GCash payment confirmation.
 *
 * `paymentRef` is the Payment Transaction ID and serves as the idempotency key
 * (v3.1 §20). A duplicate webhook with the same paymentRef must be ignored.
 *
 * Audit #11 — the signature is verified separately from the raw body (HMAC over
 * the exact bytes), so DTO parsing happens after signature verification. The
 * signature itself is passed as a header, not in this body.
 *
 * Source: Kreav Backend PRD v3 — §9 + BE-005.
 */
export class GcashWebhookDto {
  @IsUUID()
  orderId!: string;

  /**
   * Payment Transaction ID — idempotency key. Non-empty string.
   * NOT NULL is enforced at the DB layer too (audit #5), but we validate here
   * to give a clean 400 before touching the database.
   */
  @IsString()
  @IsDefined()
  @Matches(/\S/, { message: 'paymentRef must not be empty' })
  paymentRef!: string;
}
