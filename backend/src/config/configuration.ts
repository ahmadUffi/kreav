import * as Joi from 'joi';

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
}

/** Dev-only JWT secret fallback — the auth module warns loudly when active. */
export const DEV_JWT_SECRET = 'kreav-dev-jwt-secret-do-not-use-in-prod';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string()
    // PostgreSQL connection string — required now that Prisma/DB is wired (BE-002).
    .uri({ scheme: ['postgresql', 'postgres'] })
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
      otherwise: Joi.optional().default(DEV_JWT_SECRET),
    }),
});

export default () => ({
  NODE_ENV: process.env.NODE_ENV,
  PORT: parseInt(process.env.PORT ?? '3000', 10),
  DATABASE_URL: process.env.DATABASE_URL,
  GCASH_WEBHOOK_SECRET: process.env.GCASH_WEBHOOK_SECRET,
  JWT_SECRET: process.env.JWT_SECRET ?? DEV_JWT_SECRET,
});
