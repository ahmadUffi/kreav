# Kreav Observability PRD

> **Status:** Canonical operational-visibility design. MVP-aligned: structured logs + health + targeted monitoring. Distributed tracing is a documented future step, not an MVP dependency.
> **Scope:** the NestJS backend in production (VPS · Docker Compose). Frontend/chain observability referenced where they interface.
> **Authority on conflict:** Architecture Consistency Check → Kreav Backend PRD v3.1 → this document.

---

## 1. Logging

**WHAT:** structured JSON logs to stdout, captured by Docker (`docker compose logs`). NestJS `Logger` is the app-level logger; Prisma logs at `emit: 'stdout'` (audit #3 — not `'event'`, which leaked). The `EventLogListener` emits a structured line per domain event (`payment.received`, `settlement.completed`, `wallet.connect.required`).

**WHY structured + stdout:**
- **Structured JSON** → machine-parseable for search/alerts (a free-text log is unqueryable in an incident).
- **stdout, not files** → Docker's logging driver manages the log lifecycle (rotation, retention); the container stays stateless. Twelve-factor.
- **Event lines** → during the demo, the console shows "payment.received → order=... amount=10.00" — a visible, reassuring trail (Final Architecture principle 7: every blockchain action visible).

---

## 2. Structured Logging

Every log line carries:
- `timestamp` (ISO 8601, UTC)
- `level` (`log`/`warn`/`error`)
- `context` (module/class name)
- `message`

Business-event logs additionally carry the IDs below. The shape is stable so log queries/dashboards don't break.

---

## 3. Correlation IDs

**WHAT:** every request gets a `requestId` (generated or echoed from an `X-Request-Id` header). Every log line in that request's path carries the `requestId`, so a single user action is traceable across controller→service→DB→RPC.

**WHY:** without a correlation ID, logs from concurrent requests interleave and an incident investigation becomes guesswork. The `requestId` lets you filter "all logs for this checkout."

---

## 4. Request IDs

**Generation:** a global middleware/interceptor assigns a UUID per request if none is provided. It's echoed back in the response header `X-Request-Id` so a user reporting a bug can cite it.

**Why echo it:** the fastest incident report is "the X-Request-Id is abc-123." Without it, support has to approximate by time.

---

## 5. Order IDs

Every log touching an Order carries `orderId`. Settlement/webhook/payment logs all include it. An order is the unit of a purchase's lifecycle, so `orderId` is the primary join key across logs, DB rows, and on-chain txHash.

---

## 6. Settlement IDs

Settlement logs carry `orderId` (the 1:1 link) + `txHash` (the on-chain proof). The `settlement.completed` event log includes creator/platform amounts — so "did the split happen correctly?" is answerable from logs alone.

---

## 7. Metrics (MVP)

**WHAT:** MVP surfaces metrics via logs + `docker stats` / host metrics (CPU/RAM). **No dedicated metrics server (Prometheus) in MVP.**

**Key signals derivable from logs/DB:**
- Settlement success rate (count `settlement.completed` vs `SETTLEMENT_FAILED`).
- Webhook idempotency hits (duplicate-`paymentRef` acks).
- Notification retry/dead-letter counts.
- p95 settlement latency (emit a duration on `settlement.completed`).

**Why no Prometheus in MVP:** the demo has trivial volume; `docker stats` / host metrics + log-derived counts suffice. Prometheus + Grafana is the natural post-MVP addition (§15).

---

## 8. Health Endpoints

**WHAT:** `GET /health`.
- **MVP (liveness):** `{ status: "ok" }` if the process is up.
- **Recommended (readiness):** add a `SELECT 1` against Postgres so the compose healthcheck reflects DB connectivity (audit #15). Split liveness (`/health`) from readiness (`/health/ready`) so a transient DB blip doesn't kill the process.

**Why split:** liveness = "should this container be killed?" (no — process is fine); readiness = "should traffic route here?" (no — DB down). Conflating them causes unnecessary restarts during a DB hiccup.

---

## 9. Monitoring

**External dependencies monitored (the demo's real risk surface — audit #20):**
| Dependency | How monitored | Alert on |
|------------|---------------|----------|
| **Soroban RPC (Testnet)** | startup probe + per-settle latency log | outage / sustained high latency |
| **Horizon (Testnet)** | per-balance-read latency + error rate | timeout spike |
| **PostgreSQL (Neon)** | `/health/ready` SELECT 1 + Neon dashboard | connection failures |
| **Resend** | send success/failure in NotificationLog | failure spike |
| **Platform USDC float (ADR C1)** | periodic Horizon `loadAccount(PLATFORM_WALLET_ADDRESS)` USDC balance read | balance < N settlements' worth (e.g. < 50 USDC) → top-up alert |

**Why Testnet deps are the focus:** the demo's most likely failure is Testnet flakiness, not app code (audit #20). Pre-demo smoke (Testing PRD §17) is the primary guard.

---

## 10. Alerts

**MVP: lightweight.** GitHub Actions deploy-failure notifications + a periodic check of `SETTLEMENT_FAILED`/`WAITING_WALLET` counts (a spike = stuck money or onboarding breakage) + a **low platform-USDC-float alert** (ADR C1 — if the float drops below ~N settlements' worth, top up before a `settle` reverts on insufficient balance).

**Post-MVP:** alerts on settlement-success-rate drop, RPC/Horizon error-rate, dead-letter queue growth.

**Why minimal:** no 24/7 on-call for a hackathon; the pre-demo smoke + log visibility cover the demo's reliability. Alerts scale with the product.

---

## 11. Audit Logs

**WHAT:** immutable records of money-relevant state changes. In Kreav, these *are* the domain tables:
- `Order` status transitions (with `txHash`, `paymentRef`).
- `Settlement` + `SettlementRecipient` (the on-chain distribution mirror).
- `Withdrawal` status.
- `NotificationLog` (delivery attempts).

**WHY tables-as-audit:** the chain is the ultimate audit (immutable txHash), and the DB mirrors it. No separate audit-log table is needed in MVP — the domain rows *are* the audit trail. Each carries `created_at`/`updated_at` (the audit #9 gap — `SettlementRecipient` needs a `created_at`).

---

## 12. Tracing (MVP: absent)

**WHAT (future):** distributed tracing (OpenTelemetry) linking frontend → backend → RPC → contract.

**MVP stance:** absent. The `requestId` correlation (§3) + event logs give request-scoped visibility without a full tracing backend. Tracing is §15.

---

## 13. Performance Metrics

**WHAT:** p95/p99 latency per endpoint, surfaced via log-derived durations (emit a `durationMs` on completion of settlement/balance/withdraw). Slow-query detection via Prisma's query log (`emit: 'stdout'` flags long queries in dev).

**Why log-derived over a metrics server in MVP:** keeps ops minimal; latency spikes still show up in logs. A real APM (§15) adds precision.

---

## 14. Slow Query Detection

**WHAT:** Prisma `emit: 'stdout'` logs queries + durations. In dev, scan for queries > Nms. In prod, the log drain surfaces outliers.

**Why:** a missing index or an N+1 (e.g., loading collaborators per settlement) shows as a slow query before it shows as a timeout.

---

## 15. RPC / Horizon / Resend / Webhook Monitoring

| Surface | Signal | MVP source |
|---------|--------|-----------|
| **Soroban RPC** | invocation success/failure, simulate-error, poll latency | SettlementService logs |
| **Horizon** | balance-read latency, timeout | WalletService logs |
| **Resend** | send success/failure, retry/dead-letter | NotificationLog |
| **Webhook (`/webhooks/gcash`)** | signature-reject count, idempotency-hit count, state-transition count | Webhook controller logs |

Each is a log line with the relevant IDs; a dashboard (post-MVP) aggregates them.

---

## 16. Dashboard Recommendations

**MVP (Docker/host tooling):** `docker stats` CPU/RAM + `docker compose logs` search + GitHub Actions deploy history.

**Post-MVP dashboard panels:**
1. Settlement success rate + p95 latency.
2. Webhook: received / idempotent-dup / signature-rejected.
3. Wallet: balance-read latency + Horizon error rate.
4. Notifications: sent / failed / dead-lettered.
5. Orders by state (spot `WAITING_WALLET` / `SETTLEMENT_FAILED` accumulation).

---

## 17. Production Incident Flow

1. **Detect** — alert or user report; capture the `X-Request-Id` / `orderId` / `txHash`.
2. **Triage** — filter logs by the ID; identify the failing stage (webhook / settlement / RPC / DB).
3. **Contain** — if a bad deploy, rollback the image (Deployment PRD §17); if stuck money, run the recovery job / verify-poll.
4. **Resolve** — fix forward; add a regression test (Testing PRD §18).
5. **Postmortem** — short doc: what, why, prevention. For money incidents, mandatory.

---

## 18. Failure Investigation Flow

**Given an `orderId`:**
1. Logs: `grep orderId` → see the lifecycle (checkout → webhook → settle → verify).
2. DB: `Order`, `Settlement`, `SettlementRecipient`, `Withdrawal` rows.
3. Chain: `getTransaction(txHash)` on RPC → authoritative truth.
4. Reconcile: does the DB mirror the chain's `returnValue`? (They must match — Soroban Contract PRD §12.)

The 3 sources (logs / DB / chain) must agree. A mismatch is a bug, not an operational nuisance.

---

## 19. Future OpenTelemetry Discussion

**When to adopt:** multi-service (frontend + backend + worker), or when request-scoped logs aren't enough to pin a cross-boundary latency. **What it adds:** spans across the HTTP→service→RPC→contract path, with the `orderId`/`txHash` as baggage. **Cost:** an OTel collector + exporter (Jaeger/Tempo). **For Kreav:** justified post-MVP when reliability SLOs demand it; the correlation-ID scaffolding (§3) makes adoption incremental.

---

*Cross-reference: the events being logged → **Kreav Sequence Diagram Bible**; the runtime emitting logs → **Kreav Runtime Flow Bible**; what counts as an incident → **Kreav Security PRD**; the logs as audit → **Kreav Security PRD**.*
