# Kreav Backend — Security & Reliability Audit

> **⚠️ Historical (point-in-time) audit — 2026-06-26.** Criticals were fixed; remaining items were folded into ROADMAP phases. Kept for the record; platform-specific mentions below (e.g. Vercel→Railway) reflect the deployment target *at audit time* — the current stack is a self-hosted VPS + Docker Compose + Caddy + Neon (see `docs/backend/Deployment-PRD.md`).
>
> Full audit conducted 2026-06-26. Covers BE-001/002/003 + planned tasks + PRD v3.1 + CI + config.
> **4 CRITICAL findings fixed in `fix/audit-critical-fixes` PR.** Remaining 18 recorded here per task owner's choice ("fix critical now, fold rest into tasks").

## Status legend
- ✅ Fixed (in `fix/audit-critical-fixes` PR)
- 🔜 Folded into a specific task
- 📋 Tracked here as debt (no task yet)

---

## ✅ FIXED — Critical (in audit PR)

| # | Finding | Fix |
|---|---|---|
| 1 | CVE HIGH: multer DoS (GHSA-3p4h-7m6x-2hcm) transitive via @nestjs/platform-express | `pnpm-workspace.yaml` overrides → multer `>=2.2.0` |
| 2 | No graceful shutdown — SIGTERM/SIGINT kills process before Prisma `$disconnect()` (leaked conns + lost settlements) | `app.enableShutdownHooks()` in main.ts |
| 3 | PrismaService `emit:'event'` with no listener → memory leak + deprecation warning | changed to `emit:'stdout'` |
| 4 | No CORS/Helmet — browser blocks cross-origin (Vercel→Railway), demo "API errors" | `app.use(helmet())` + `app.enableCors()` |

---

## 🔜 Folded into specific tasks

### BE-004 (Product APIs) — Decimal serialization
- **#10 Decimal→JSON breaks**: Prisma returns `Prisma.Decimal`; default JSON serializer mangles money (`{d:[...]}`). Add a global interceptor serializing `Decimal → string` in all responses. Otherwise product `priceUsd` shows as garbage in the API.

### BE-005 (Checkout/Webhook) — auth & idempotency
- **#5 `Order.payment_ref` nullable+UNIQUE**: semantics leak — null rows unprotected. Make NOT NULL at checkout, or use partial unique index.
- **#7 No rate limiting** on `POST /checkout`, webhooks, `/wallet/withdraw`. Add `@nestjs/throttler`.
- **#11 Webhook signature not in plan**: `POST /webhooks/gcash` accepts `{ orderId, paymentRef }` with no signature → anyone can trigger settlement. Add HMAC shared secret even for "mock" GCash.

### BE-011 (Seeder) — idempotency
- **#14 Seed idempotency**: `upsert` by email but `wallet_address` UNIQUE will collide on second run. Seed must handle multi-unique carefully.

### BE-012 (Error handling) — domain exceptions
- **#12 No domain exception hierarchy**: build `src/common/exceptions/` base classes (`DomainException`, `FinancialException`) so error catalog isn't `throw new HttpException()` scattered.
- **#18 In-process event bus = settlement loss on crash**: `@nestjs/event-emitter` loses in-flight events if process dies between emit and settlement complete. Add a **startup recovery job** that resumes orders stuck in `PAYMENT_RECEIVED`/`SETTLEMENT_PENDING`. Without this, a crash mid-demo = stuck money.

### BE-013 (Notification) — scheduling
- **#19 Retry worker scheduling mechanism undefined**: needs `@nestjs/schedule` (cron) or explicit `setInterval`. In-memory interval doesn't survive restart — acceptable for demo but must be a conscious decision.

---

## 📋 Tracked debt (low severity / decisions)

| # | Finding | Severity | Note |
|---|---|---|---|
| 6 | Config factory `NODE_ENV` can be undefined; factory reads `process.env` directly (can mismatch Joi-validated value) | low | Tighten in config refactor |
| 8 | `Order` has no FK to User (buyer) — `buyer_email` only. Can't query "buyer's orders" cleanly. **Confirm if intentional** (anonymous buyer) | decision | Ask |
| 9 | `SettlementRecipient` has no `created_at` — can't audit chronological recipient ordering | low | Add timestamp |
| 13 | Config (factory+schema+type) in one file — will bloat with Stellar/Resend vars | low | Split to `config/env/` per domain |
| 15 | `/health` doesn't check DB — returns ok even if DB down. Railway readiness probe needs deep health | low | Add `SELECT 1` check |
| 16 | CI doesn't reject major-version dep bumps in PRs | low | Add `pnpm-diff` check or dependabot config |
| 17 | ESLint `no-explicit-any: warn` — should be `error` for financial code | low | Flip to error |
| 20 | **Stellar Testnet reliability = high demo risk** — Horizon/Soroban often down/rate-limited. Demo fails on infra, not code | risk | Pre-record txHash backup OR demo-mode flag |
| 21 | **Trustline setup on stage = demo killer** — WAITING_WALLET + trustline need live creator action. Must pre-fund + pre-trustline all wallets BEFORE demo | risk | Seed in BE-011 |
| 22 | `pnpm-workspace.yaml` `onlyBuiltDependencies` fragile across fresh clones / CI envs | low | Monitor |

---

## Residual CVE (accepted)

- **js-yaml <=4.1.1 (moderate, DoS)** — in jest/istanbul **dev-only** config parsing, not runtime attack surface. No upstream patch exists (`<=4.1.1` = all versions affected). **Accepted** — re-evaluate when patched.

---

## How to use this file
- When starting a task, grep this file for that task number — fix its findings as part of the task.
- `📋 Tracked debt` items: surface to team during sprint planning.
- `risk` items (20, 21): these are **demo-day operational** risks, not code — handle in BE-011 seed + run-sheet.
