import * as Joi from 'joi';
import { randomBytes } from 'node:crypto';

/**
 * Typed application configuration.
 * Every env var consumed by the app must be declared here AND validated in
 * `validationSchema` below. Reading via `configService.get('KEY', { infer: true })`
 * gives back a typed value.
 *
 * Source: Kreav Backend PRD v3 — Section 15 (Environment Variables).
 * Only the foundation-stage vars are validated here (NODE_ENV, PORT, DATABASE_URL);
 * Stellar/Horizon/Soroban vars are added by the tasks that introduce them (BE-007+).
 */
export interface AppConfig {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  /** Audit #11 — HMAC secret for verifying GCash webhook signatures. Optional
   * in dev (webhook accepts unsigned), REQUIRED for the on-stage demo. */
  GCASH_WEBHOOK_SECRET?: string;
  /** Signing secret for session JWTs (SEP-10 wallet auth + register). Falls
   * back to a dev-only default; MUST be set in production. */
  JWT_SECRET: string;
  /** Resend API key for transactional email (product-delivery). Optional in
   * dev — when absent, emails are logged instead of sent. */
  RESEND_API_KEY?: string;
  /** From address for outgoing email. Defaults to Resend's shared sender. */
  RESEND_FROM: string;
  /** When true, exposes the in-app payment simulation endpoint so buyers/judges
   * can complete a purchase without a real PSP. Off in production. */
  DEMO_MODE: boolean;
}

/** Dev-only JWT secret — auto-generated per process start (never committed). */
export function generateDevJwtSecret(): string {
  return randomBytes(32).toString('hex');
}

/** Default From address for outgoing email when RESEND_FROM is unset. */
export const DEFAULT_RESEND_FROM = 'Kreav <onboarding@resend.dev>';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string()
    // PostgreSQL (production/Docker) or SQLite file: URI (local zero-config dev).
    .pattern(/^(postgresql:\/\/|postgres:\/\/|file:)/)
    .required(),
  // Optional: when absent, webhook signature verification is skipped (dev/CI).
  GCASH_WEBHOOK_SECRET: Joi.string().optional().allow(''),
  // Session JWT secret. Required in production; dev/test fall back to a
  // clearly-marked default so the app still boots for non-auth work.
  JWT_SECRET: Joi.string()
    .min(16)
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  // Optional email config — absent key → emails are logged, not sent (dev).
  RESEND_API_KEY: Joi.string().optional().allow(''),
  RESEND_FROM: Joi.string().optional().allow(''),
  // Boolean-ish; coerces "true"/"false". Off in production unless set.
  DEMO_MODE: Joi.boolean().optional(),
});

export default () => ({
  NODE_ENV: process.env.NODE_ENV,
  PORT: parseInt(process.env.PORT ?? '3000', 10),
  DATABASE_URL: process.env.DATABASE_URL,
  GCASH_WEBHOOK_SECRET: process.env.GCASH_WEBHOOK_SECRET,
  JWT_SECRET: process.env.JWT_SECRET || generateDevJwtSecret(),
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM: process.env.RESEND_FROM || DEFAULT_RESEND_FROM,
  // Explicit "true"/"false" wins; otherwise on everywhere except production.
  DEMO_MODE: process.env.DEMO_MODE
    ? process.env.DEMO_MODE === 'true'
    : process.env.NODE_ENV !== 'production',
});
