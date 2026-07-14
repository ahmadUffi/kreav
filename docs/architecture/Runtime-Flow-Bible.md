# Kreav Runtime Flow Bible

> **Status:** Canonical description of how the Kreav backend behaves *while running*. Every WHAT is paired with a WHY.
> **Scope:** the NestJS modular-monolith backend (`KREAV-app/backend`). Frontend runtime and the Soroban contract's on-chain execution are out of scope (see their respective PRDs).
> **Authority on conflict:** Official Stellar docs → Architecture Consistency Check → Kreav Backend PRD v3.1 → this document.

---

## Table of Contents

1. System Startup · 2. Configuration Loading · 3. Dependency Injection · 4. NestJS Lifecycle · 5. PostgreSQL Startup · 6. Soroban RPC Connection · 7. Horizon Connection · 8. Resend (Email) Connection · 9. Environment Validation · 10. Request Lifecycle · 11. Order State Machine · 12. Settlement State Machine · 13. Withdrawal State Machine · 14. Notification Lifecycle · 15. Failure Recovery · 16. Graceful Shutdown · 17. Architecture Principles (runtime view)

> Note on Redis: **Kreav's MVP does not use Redis.** The retry queue, throttler storage, and event bus are all in-process (NestJS EventEmitter + `@nestjs/throttler` default in-memory storage + DB-backed retry state). Redis is discussed in §17 as a future option. This section exists in the task spec but the honest answer is "not present in MVP" — documented as a deliberate decision, not a gap.

---

## 1. System Startup

**WHAT:** The process boots, validates config, wires NestJS modules, connects Postgres, registers crons, and runs a startup recovery job before listening on PORT.

**WHY this order:**
1. **Config first** — if `DATABASE_URL`/`SOROBAN_RPC_URL` are missing or malformed, the app must fail *before* binding a port (fail fast; no half-alive containers that Railway routes traffic to). Joi `abortEarly: false` reports all errors at once.
2. **DI before connections** — NestJS instantiates providers in dependency order; Prisma/RPC/Horizon clients are lazy so their constructors are cheap, but the `onModuleInit` hooks connect eagerly where needed.
3. **Startup recovery before listen** — orders stuck in `PAYMENT_RECEIVED`/`SETTLEMENT_PENDING` (from a crash mid-settlement) must resume *before* new traffic arrives, so the system starts in a consistent state (audit #18). Without this, a crash mid-demo = stuck money.
4. **Crons last** — retry/notification workers must not fire before recovery completes (they'd compete with the recovery job).

See Sequence Diagram Bible §20 for the full startup sequence.

---

## 2. Configuration Loading

**WHAT:** `ConfigModule.forRoot({ isGlobal, load: [configuration], validationSchema, validationOptions: { abortEarly: false } })` loads env vars into a validated, typed `AppConfig`.

**WHY:**
- **Global** — every module needs config (RPC URL, DB URL, secrets); making it global avoids re-importing `ConfigModule` everywhere.
- **Joi schema** — `DATABASE_URL` must be a `postgresql://` URI; `PORT` a valid port; `GCASH_WEBHOOK_SECRET` optional (dev escape hatch). Validation at boot catches typos like `DATABASE_URL=mysql://...`.
- **Factory function** — `configuration()` reads `process.env` once and returns a typed object, so downstream code gets `config.get<string>('SOROBAN_RPC_URL')` with type safety, not raw `process.env` lookups that drift (audit #6).
- **abortEarly: false** — surface *all* env errors at once (not one-by-one through 10 deploys).

**Env vars (authoritative list, Backend PRD §15):** `DATABASE_URL`, `HORIZON_URL`, `SOROBAN_RPC_URL`, `PLATFORM_WALLET_ADDRESS`, `USDC_ASSET_CODE`, `USDC_ISSUER`, `SPLIT_CONTRACT_ID`, `GCASH_WEBHOOK_SECRET` (optional).

---

## 3. Dependency Injection

**WHAT:** NestJS DI wires modules in import order. AppModule imports: `ConfigModule`, `EventEmitterModule.forRoot()`, `ThrottlerModule.forRoot()`, then feature modules (`PrismaModule`, `HealthModule`, `EventsModule`, `ProductsModule`, `OrdersModule`, …). `ThrottlerGuard` is registered as an `APP_GUARD` so rate-limiting applies globally.

**WHY:**
- **EventEmitterModule at top level** — the `@OnEvent` decorator must be active before any module emits; if a feature module imported it locally, the ordering could miss early events.
- **ThrottlerModule global** — every endpoint gets default rate-limiting (100/min); per-route overrides (`@Throttle`) tighten checkout/webhook (audit #7). Global guard = can't forget to protect a route.
- **PrismaModule exported** — every feature needs the DB client; exporting it from a single module avoids N Prisma clients.
- **Feature modules self-contained** — each (`Products`, `Orders`, …) owns its controller + service + DTOs; no god-module. This matches the Backend PRD's modular-monolith style.

---

## 4. NestJS Lifecycle

**WHAT (lifecycle hooks used):**
- `OnModuleInit` — `PrismaService.$connect()`.
- `OnApplicationBootstrap` — register cron jobs (`@nestjs/schedule`); startup recovery job runs here.
- `enableShutdownHooks()` — SIGTERM/SIGINT trigger `OnModuleDestroy` → `PrismaService.$disconnect()`.

**WHY:**
- **Eager connect in `OnModuleInit`** — fail fast at boot if Postgres is unreachable, rather than failing on the first request.
- **Cron registration in bootstrap** — crons need all modules instantiated; bootstrap is the first point where that's guaranteed.
- **Shutdown hooks** — without them, SIGTERM kills the process before Prisma disconnects, leaking connections (audit #2). Critical on Railway, which sends SIGTERM on redeploy.

---

## 5. PostgreSQL Startup

**WHAT:** `PrismaService` extends `PrismaClient`, connects in `OnModuleInit`, disconnects in `OnModuleDestroy`. Migrations run *before* the app starts (in CI and deploy: `prisma migrate deploy`).

**WHY:**
- **Migrate before boot** — the app assumes the schema exists; running migrations at boot races with request handling. `prisma migrate deploy` (non-interactive) runs in the release phase / CI.
- **`emit: 'stdout'`** — Prisma logs to stdout (NOT `'event'`, which caused a memory leak with no listener — audit #3). Stdout logs are captured by Railway's log drain.
- **Decimal money** — all money columns are `Decimal(18,2)`; Prisma returns `Prisma.Decimal`, which the global `DecimalToStringInterceptor` serializes to `"10.00"` (audit #10). Never float.

---

## 6. Soroban RPC Connection

**WHAT:** A lazy `rpc.Server(SOROBAN_RPC_URL)` client, instantiated when the SettlementService first needs it. No eager health probe at boot (RPC may be briefly unavailable without blocking startup).

**WHY:**
- **Lazy, not eager** — the RPC endpoint is only needed at settlement time. Eagerly probing it at boot would make startup flaky on Testnet outages (audit #20). The deep health check can probe it, but startup must not depend on it.
- **Testnet endpoint** — `https://soroban-testnet.stellar.org`. RPC is the **primary** path for contract invoke + verify (Stellar Standards §7).

---

## 7. Horizon Connection

**WHAT:** A lazy `Horizon.Server(HORIZON_URL)` client, used by the Wallet Module for `loadAccount` (balance + trustline status) and explorer-facing reads.

**WHY:**
- **Horizon for balance/trustline reads** — `loadAccount` returns a rich balance object (USDC credit balance + trustline authorization), exactly what the wallet screen and pre-settlement trustline check need. RPC's `getAccount` is terser.
- **Horizon is secondary for Soroban** — settlement submission/verification goes through RPC; Horizon is display/historical only (Stellar Standards §6).
- **Lazy** — same reason as RPC: don't block boot on Testnet flakiness.

---

## 8. Resend (Email) Connection

**WHAT:** The Notification Module holds a Resend client (API key from env). Emails are sent via an Adapter (v3.1 §18), so the provider is swappable. `NotificationLog` rows persist retry state.

**WHY:**
- **Adapter pattern** — decouples business logic from the email provider; swapping Resend for another provider doesn't touch event handlers.
- **NotificationLog before send** — durability: if the process dies mid-send, the log exists and the retry cron picks it up (audit #19). State in DB, not memory.
- **Async, non-blocking** — a notification failure never rolls back a settlement/withdrawal (v3.1 §18).

---

## 9. Environment Validation

**WHAT:** Joi validates env at `ConfigModule` load. Required: `DATABASE_URL` (postgresql URI), `SOROBAN_RPC_URL`, `HORIZON_URL`, `PLATFORM_WALLET_ADDRESS`, `USDC_ASSET_CODE`, `USDC_ISSUER`, `SPLIT_CONTRACT_ID`. Optional: `GCASH_WEBHOOK_SECRET` (dev escape hatch), `NODE_ENV`, `PORT`.

**WHY:**
- **Fail fast** — a missing `DATABASE_URL` must abort boot, not crash on first query.
- **`GCASH_WEBHOOK_SECRET` optional** — in dev/CI there's no real secret; the webhook verifier accepts unsigned + logs a warning. **On-stage demo MUST set it** so a forged payment can't trigger settlement (audit #11).
- **`SPLIT_CONTRACT_ID` required** — the SettlementService can't invoke without it.

---

## 10. Request Lifecycle

**WHAT (the path of an HTTP request):**
1. **Helmet** (security headers) + **CORS** + **rawBody: true** (for webhook HMAC).
2. **ThrottlerGuard** — rate-limit check (global default; tighter on checkout/webhook).
3. **Router** → Controller method.
4. **ValidationPipe** (`whitelist`, `transform`, `forbidNonWhitelisted`) — DTO validation; strips unknown fields.
5. **Controller** → **Service** → **Prisma** (or RPC/Horizon/Resend).
6. **DecimalToStringInterceptor** (global) — serializes `Prisma.Decimal` → `"10.00"` in the response.
7. **Exception filter** — maps domain exceptions to HTTP codes.

**WHY each stage:**
- **rawBody** — HMAC verification needs the exact bytes the client sent (audit #11). NestJS exposes `req.rawBody` when configured.
- **whitelist + forbidNonWhitelisted** — reject unknown fields outright (defense against mass-assignment); e.g. a `POST /products` with an `evil` field → 400.
- **DecimalToStringInterceptor global** — money must never leak as `{d:[...]}`; a global interceptor covers every endpoint, not just the ones that remember to map (audit #10).
- **ValidationPipe transform** — query params (`page`, `limit`) arrive as strings; `@Type(() => Number)` coerces so validators see numbers.

---

## 11. Order State Machine

**WHAT:** The 13-state Order lifecycle (v3.1 §20). Only legal transitions pass; illegal → `InvalidStateTransitionException` (400 `INVALID_STATE_TRANSITION`).

```
CREATED → CHECKOUT_STARTED → PAYMENT_PENDING → PAYMENT_RECEIVED
       → SETTLEMENT_PENDING → SETTLED → WITHDRAW_PENDING → WITHDRAW_COMPLETED

Failure/deferral:
PAYMENT_PENDING    → PAYMENT_FAILED
PAYMENT_RECEIVED   → WAITING_WALLET
WAITING_WALLET     → SETTLEMENT_PENDING
SETTLEMENT_PENDING → SETTLEMENT_FAILED
WITHDRAW_PENDING   → WITHDRAW_FAILED
any non-terminal    → CANCELLED
```

**WHY a strict machine:**
- **Money safety** — an order can't jump from `PAYMENT_PENDING` to `SETTLED` (skipping settlement) or go backwards; the machine makes illegal money flows impossible at the app layer.
- **Terminal states are append-only** — `WITHDRAW_COMPLETED`, `PAYMENT_FAILED`, `SETTLEMENT_FAILED`, `CANCELLED` have no outgoing edges; a completed/failed order can't be revived.
- **`WAITING_WALLET` is a deferral, not failure** — keeps the buyer's payment safe while the creator onboards a wallet/trustline.
- **Pure + unit-tested** — the transition map is Prisma-free logic, exhaustively tested (22 cases), so the rules are provable.

---

## 12. Settlement State Machine

**WHAT:** A `Settlement` row goes `PENDING → COMPLETED | FAILED`. One `Settlement` = one on-chain transaction; N `SettlementRecipient` rows = its accounting distribution (1 canonical + N children).

**WHY:**
- **1:1 Settlement:txHash** — each settlement maps to exactly one Soroban transaction (its `txHash`), making on-chain verification 1:1.
- **N recipients** — mirrors the contract's multi-recipient output (platform + each collaborator). Derived from the contract's `returnValue`, never recomputed.
- **No `SETTLEMENT_PENDING` here** — the *Order* tracks settlement progress (`SETTLEMENT_PENDING`); the `Settlement` row is only created on success (atomic with recording). A failed settle leaves no Settlement row (the Order is `SETTLEMENT_FAILED`).

---

## 13. Withdrawal State Machine

**WHAT:** `Withdrawal.status`: `PENDING → COMPLETED | FAILED`.

**WHY:**
- **Simple two-terminal** — withdrawal is a single off-ramp action (mock in MVP); no multi-stage progress needed.
- **No fund loss on failure** — `FAILED` means the creator's funds stay in their wallet (mock anchor moved nothing in MVP; real anchor holds funds during swap). The state exists for UX/tracking, not money risk.

---

## 14. Notification Lifecycle

**WHAT:** `NotificationLog.status`: `PENDING → SENT | FAILED`. `attempts` increments on failure; retry cron (Seq. 17) resends up to 3× with exponential backoff; dead-lettered after 3.

**WHY:**
- **State in DB, not memory** — survives restarts (audit #19). An in-memory interval would lose pending notifications on redeploy.
- **Non-blocking** — the business event handler emits → Notification Module creates a log + attempts send → returns immediately. A slow/broken Resend never stalls settlement.
- **Dead-letter, not infinite retry** — caps resource use and noise; 3 attempts with backoff is enough for transient provider failures.

---

## 15. Failure Recovery

**WHAT (three recovery mechanisms):**
1. **Startup recovery** (audit #18) — on boot, find Orders in `PAYMENT_RECEIVED`/`SETTLEMENT_PENDING` and resume them (verify-poll or re-emit `payment.received`).
2. **Scheduled retry** (Seq. 29) — cron scans retryable rows (notifications FAILED < 3; settlements stuck) by `nextAttemptAt`.
3. **Request-level retry** — Horizon/RPC reads retry with backoff on timeout (Backend PRD §20: max 3).

**WHY:**
- **In-process event bus loses in-flight events on crash** — `@nestjs/event-emitter` is synchronous in-memory; if the process dies between emit and settlement, the event is gone. The startup recovery job reconstructs the in-flight state from the DB (`PAYMENT_RECEIVED` = "payment was received, settlement not yet recorded"). Without this, a crash mid-demo = stuck money.
- **Retries verify, not re-invoke** — the cardinal rule: never re-invoke a settle that already succeeded (double-settle risk). If a txHash exists, retry the *verify poll* only. The contract's `order_ref` guard is the last line of defense (Soroban Contract PRD §9).

---

## 16. Graceful Shutdown

**WHAT:** `enableShutdownHooks()` → SIGTERM/SIGINT → `OnModuleDestroy` → `PrismaService.$disconnect()`. Crons stop; in-flight HTTP requests drain (NestJS default).

**WHY:**
- **Connection leak prevention** — without disconnect, SIGTERM kills the process and Postgres connections leak until the pool times out (audit #2). Railway sends SIGTERM on every redeploy.
- **Drain in-flight** — a settlement mid-verify shouldn't be killed abruptly; shutdown hooks give NestJS a chance to finish the current request cycle. Anything not finished is caught by startup recovery on the next boot.

---

## 17. Architecture Principles (runtime view)

The 8 Final-Architecture principles, expressed as runtime decisions:

| Principle | Runtime manifestation |
|-----------|----------------------|
| Stellar = settlement layer | RPC/Horizon clients are *only* in the Settlement + Wallet modules; no other module touches the chain |
| Soroban = programmable split only | The one contract (`settle`) is invoked only by SettlementService; no other on-chain logic in MVP |
| PostgreSQL = application state | All Users/Products/Orders/Wallets/Settlements/Withdrawals live in Postgres; the chain is verification, not the source of app truth |
| Blockchain = settlement state | Balance truth = Horizon; settlement truth = RPC `getTransaction` |
| Buyers never touch blockchain | The buyer's entire flow is `POST /checkout` + GCash mock; no wallet, no key |
| Creators never need crypto knowledge | Creator connects a wallet (public key only); trustline/onboarding is prompted, not assumed |
| Every blockchain action visible in demo | txHash + explorer link surfaced on every settlement (Screen 5/7) |
| Complexity minimized | No Redis, no queue infra, no microservices in MVP — modular monolith + in-process bus + DB-backed retries |

### Why no Redis / message queue in MVP

**Decision:** the event bus (`@nestjs/event-emitter`), throttler storage, and retry queue are **in-process** (DB-backed for durability). **Tradeoff:** simpler ops (one fewer service), but an in-process bus loses in-flight events on crash — mitigated by the startup recovery job (§15). **Future:** if event volume or reliability demands it, Redis (for throttler/pub-sub) or a real queue (BullMQ/SQS) can be introduced without changing the event *contracts* (the `AppEvents` names + typed payloads stay). This is a conscious MVP simplification, not an oversight.

---

*Cross-reference: the sequences these flows enact → **Kreav Sequence Diagram Bible**; deploying this runtime → **Kreav Deployment PRD**; testing it → **Kreav Testing PRD**; observing it → **Kreav Observability PRD**.*
