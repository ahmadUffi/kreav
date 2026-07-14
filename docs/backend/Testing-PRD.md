# Kreav Testing PRD

> **Status:** Canonical testing strategy for the Kreav backend. Every test type, its scope, and its CI placement.
> **Scope:** `KREAV-app/backend`. Frontend and Soroban-contract testing are referenced where they interface with the backend but are owned by their respective teams.
> **Authority on conflict:** Architecture Consistency Check → Kreav Backend PRD v3.1 → this document.

---

## 1. Testing Philosophy

1. **Pragmatic TDD** — write the test that captures the *behavior* first, then implement. Not "100% coverage dogma" — money-handling paths get exhaustive tests; trivial getters may be covered by integration.
2. **Money paths are exhaustively tested.** Any code touching amounts, splits, balances, or `Decimal` gets unit + e2e coverage. A money bug is a fund-loss bug.
3. **Real Postgres for e2e, mocks for unit.** Unit tests mock Prisma/RPC/Horizon (fast, isolated). E2E tests hit a real Postgres service container (DB-layer bugs surface).
4. **Stellar interactions are tested at the seam.** The RPC/Horizon *clients* are mocked in unit/integration tests; the *contract invocation pattern* (build→simulate→assemble→submit→poll) is asserted. Real testnet calls are a manual/smoke concern, not CI (Testnet flakiness would make CI non-deterministic).
5. **Every PR must keep CI green.** Lint + build + unit + e2e are gates; coverage is a signal, not a hard gate.

---

## 2. Test Pyramid

```
        ▲
        │   Smoke (manual/demo)         ← real testnet, manual, pre-demo
        │
        │   E2E (API → real Postgres)   ← 20 tests, CI gate
        │
        │   Integration (module-level)  ← Prisma real, RPC/Horizon mocked
        │
        │   Unit (pure logic + mocks)   ← 76+ tests, CI gate
        │
```

**Why this shape:** broad unit base (fast, exhaustive on money logic), a real-DB e2e layer (catches schema/transaction bugs), and a thin manual smoke on testnet (the demo itself validates the real chain).

---

## 3. Unit Tests

**Scope:** pure logic + services with Prisma/RPC mocked. Jest. Co-located: `src/**/*.spec.ts`.

**What's unit-tested:**
- `order-state-machine` — every legal + illegal transition (22 cases, exhaustive).
- `webhook-signature` — HMAC verify/reject (6 cases, audit #11).
- `decimal-to-string.interceptor` — Decimal→string serialization (audit #10).
- `products.service`, `orders.service` — business logic with mocked Prisma.
- `event-log.listener` — emit→handle wiring (BE-006).

**Money invariant unit tests:**
- Amount copied as a fresh `Decimal` (not aliased).
- Bps math (`9500/500`) sums correctly.
- `priceUsd` regex validation (≤2 decimals, non-negative).

**Why mock-heavy:** unit tests must be deterministic and <1s each. Real Postgres/RPC belong in e2e.

---

## 4. Integration Tests

**Scope:** a NestJS module (or a few) wired together, with Prisma pointed at a real Postgres, but RPC/Horizon/Resend **mocked** at the client seam.

**What they prove:** the wiring (DI, event bus, throttler, interceptor) works; the service correctly translates business events into DB writes. They don't hit Stellar.

**Why separate from e2e:** narrower blast radius — when an integration test fails, the culprit is within the module, not the HTTP layer.

---

## 5. Contract Tests (Soroban)

**Scope:** the *backend's contract invocation* against a fixed simulation fixture.

**Approach:** the SettlementService is tested with `rpc.simulateTransaction` / `sendTransaction` / `getTransaction` **stubbed** to return canned responses (success, simulation-error, tx-failed). This asserts the backend builds the right tx, handles each RPC outcome, and records correctly — without depending on Testnet uptime.

**Why not a real contract in CI:** the contract isn't deployed per-CI-run, and Testnet is flaky. The *contract's own* correctness is tested by the BC team (Rust `soroban-sdk` test env). The backend tests the *integration seam*.

---

## 6. API Tests (E2E)

**Scope:** full HTTP request → controller → service → Prisma → real Postgres. `test/**/*.e2e-spec.ts`. Run against the CI Postgres service container (migrated).

**What's covered (current 20, growing):**
- `products` — GET list/detail/pagination, POST create, validation 400s, 404.
- `orders` — checkout happy/400/404; webhook happy/idempotency/WAITING_WALLET/signature/validation.
- `health`, `database` — liveness, DB connectivity.

**Why real DB in e2e:** catches Decimal precision, FK constraints, unique-index idempotency, migration drift — things mocks hide. The e2e suite is the strongest signal that "the schema and the code agree."

---

## 7. Repository Tests

**Scope:** Prisma queries against the real DB — e.g., that `paymentRef` UNIQUE enforces idempotency, that cascades/restricts behave.

**Why:** Prisma's type system doesn't enforce DB constraints; only a real DB proves the `UNIQUE`, `RESTRICT`, `CASCADE` rules hold. These live within e2e (same DB) or as focused integration tests.

---

## 8. Settlement Tests

**Scope:** the settlement flow (Seq. 10) — event → validate collaborators → invoke → verify → record.

**Tested at three levels:**
- **Unit:** collaborator-share validation (sum 10000 bps); transition legality.
- **Integration:** SettlementService with RPC mocked — each outcome (SUCCESS/FAILED/sim-error) records correctly or sets `SETTLEMENT_FAILED`.
- **E2E:** not yet (settlement needs a deployed contract); planned for BE-007 with a mocked contract invocation but real DB recording.

**Why mock RPC here:** the *contract* is a dependency; testing that the backend reacts correctly to a SUCCESS return value is the unit of value. Real invocation is a smoke test.

---

## 9. RPC Tests

**Scope:** the RPC client wrapper — that it follows build→simulate→assemble→submit→poll, and handles `NOT_FOUND` polling, `SUCCESS`, `FAILED`.

**Approach:** mock the `rpc.Server` methods; assert call order and that `assembleTransaction` is invoked after a successful simulation (skipping it = a tx the network rejects).

**Why:** the invocation pattern is mandatory (Stellar Standards §12); a regression that skips simulation is a critical bug.

---

## 10. Webhook Tests

**Scope:** `POST /webhooks/gcash`.

**Covered (e2e, 10 cases):**
- Valid signature → 200.
- Invalid signature → 401 (when secret set; escape-hatch in dev).
- Idempotency: duplicate `paymentRef` → 200, no re-emit.
- WAITING_WALLET (no wallet) → emits `wallet.connect.required`.
- Validation: empty `paymentRef` → 400; unknown order → 404.

**Why exhaustive:** the webhook is the settlement trigger — a forgery or double-process = real money loss.

---

## 11. Anchor Mock Tests

**Scope:** the mock anchor interaction (`startWithdrawal` / `getWithdrawal` / callback).

**Approach:** the mock anchor is a stub module returning canned states (`processing` → `completed`). Tests assert the backend records `Withdrawal` status correctly and never treats the mock's "completed" as an on-chain event (balance truth = Horizon).

**Why:** the mock must faithfully implement the *shape* of SEP-24 so a real anchor is a drop-in replacement.

---

## 12. Wallet Tests

**Scope:** wallet connect (stores public key only), balance read (Horizon), trustline check.

**Covered:**
- `POST /wallet/connect` stores `walletAddress` + `provider`, never a secret.
- `GET /wallet/balance` returns real USDC balance from Horizon (mocked in unit, real-DB context in e2e where applicable).
- Trustline-absent → flagged for the WAITING_WALLET path.

**Why:** enforces non-custodial design at the test level — any test that tries to store a secret key should fail to compile/pass.

---

## 13. Notification Tests

**Scope:** event → NotificationLog creation → Resend send → status update; retry cron behavior.

**Covered:**
- A `settlement.completed` event creates a `NotificationLog(PENDING)` and attempts send.
- Send success → `SENT` + `providerMessageId`.
- Send failure → `FAILED` + `attempts++`; retry cron picks it up; dead-letters at 3.
- Notification failure does **not** roll back the business tx.

**Why:** proves the "async, non-blocking, durable" contract (v3.1 §18).

---

## 14. Failure Tests

**Scope:** every failure path in the Sequence Bible — payment failure, settlement failure, withdrawal failure, missing trustline, WAITING_WALLET, duplicate webhook.

**Asserted:** the correct terminal/deferral state is reached, no partial money movement, no double-settlement, and notifications fire where expected. These are the tests that prevent fund-loss bugs.

---

## 15. Retry Tests

**Scope:** the retry mechanism (Seq. 29) — exponential backoff, max-attempts dead-letter, crash-safe state.

**Asserted:** a retried row's `attempts` increments, `nextAttemptAt` advances, and after 3 failures it's dead-lettered (not retried forever). State is in the DB (survives a simulated restart).

**Why:** retries that don't terminate = resource exhaustion; retries that re-invoke a successful settle = double-spend.

---

## 16. Load Testing

**MVP: not automated.** The demo audience is one buyer. A light manual load check (a handful of concurrent checkouts) confirms the throttler + DB pool behave. **Post-MVP:** k6/Artillery against the checkout/webhook endpoints to find the pool/backpressure limits before scaling.

**Why deferred:** the demo has no meaningful concurrency; load testing infrastructure is unjustified now.

---

## 17. Smoke Tests

**Scope:** the pre-demo manual checklist (Demo PRD) + a real-testnet settlement dry-run.

**Manual smoke (before every demo):**
- Demo wallets pre-funded + pre-trustlined (audit #21).
- A real settlement dry-run on Testnet: buy → settle → verify txHash → explorer link.
- Withdrawal mock returns `completed`.
- Testnet RPC/Horizon reachable (audit #20).

**Why manual + real chain:** the demo's value is the real on-chain settlement; only a real Testnet run proves it. A pre-recorded txHash backup is the contingency if Testnet is down mid-demo (audit #20).

---

## 18. Regression Tests

**Scope:** every fixed audit finding gets a regression test so it can't return:
- multer CVE → `pnpm-workspace.yaml` override + a check that the resolved version ≥ 2.2.0.
- graceful shutdown → `enableShutdownHooks()` present.
- CORS/Helmet → a test asserting both are applied.
- Decimal serialization → the interceptor unit test (audit #10).
- webhook signature → the signature unit test (audit #11).
- idempotency → the duplicate-webhook e2e test (audit #5).

**Why:** "fixed once" must mean "fixed forever." Regression tests make regressions visible in CI, not on stage.

---

## 19. Security Tests

**Scope:** the Security PRD's checklist encoded as automated checks where possible:
- Rate limiting: assert throttler blocks the 101st request on checkout.
- HMAC: signature verification tests (§10).
- Input validation: `forbidNonWhitelisted` rejects unknown fields (products e2e).
- Secrets: a grep-based check that no `.env` / secret is committed.
- Dependency CVEs: `pnpm audit` in CI (non-blocking for dev-only; blocking for runtime HIGH/CRIT).

**Why automated:** security checks drift if manual. The grep/audit checks run every CI.

---

## 20. Demo Testing Checklist

The Demo PRD's "must work / can mock / cannot mock" map directly to test assertions:

| Demo requirement | Test proof |
|------------------|-----------|
| Product page | products e2e |
| Checkout | orders e2e |
| Mock payment | webhook e2e (mock GCash) |
| Settlement trigger + split | settlement integration (RPC mocked) |
| Creator wallet update | wallet e2e (balance) |
| Transaction hash | settlement records txHash |
| Explorer link | settlement returns explorer URL |
| Withdrawal | withdrawal tests (mock anchor) |
| **Cannot mock:** Stellar account/trustline/USDC/contract/txhash/balance | **smoke test on real Testnet** |

---

## 21. Coverage Expectations

| Area | Target | Rationale |
|------|--------|-----------|
| Money/split/state-machine/wallet/webhook | **≥ 95%** | fund-loss risk |
| Services (business logic) | ≥ 85% | core behavior |
| Controllers | covered by e2e | HTTP path |
| Config/bootstrap | ≥ 70% | hard to unit-test; smoke covers |
| Overall | **≥ 80%** | signal, not gate |

**Why tiered:** 100% everywhere is wasteful; money paths at 95% catch the bugs that matter. Coverage is reported by Jest lcov; SonarCloud surfaces it (Deployment PRD §5).

---

## 22. Mock Strategy

| Dependency | Unit test | Integration | E2E | Smoke |
|-------------|-----------|-------------|-----|-------|
| Prisma | mocked (jest.fn) | **real** | **real** | real |
| Soroban RPC | mocked | mocked | mocked | **real (Testnet)** |
| Horizon | mocked | mocked | real (balance read) | **real** |
| Resend | mocked | mocked | mocked | real (or skip) |
| Mock GCash | n/a | n/a | mock stub | mock |
| Mock Anchor | n/a | n/a | mock stub | mock |

**Rule:** mocks are at the *client seam* (the `rpc.Server`/`Horizon.Server`/Resend client), never deep inside business logic. This keeps the mock surface small and the real-code path large.

---

## 23. Factories & Seed Data

- **Factories:** small helper functions to build test entities (a `validProduct()`, a `mockOrder(status)`). Centralized to avoid SonarCloud duplication flags (BE-004 lesson).
- **Seed data (BE-011):** the demo dataset — Indonesian creator, "AI Interview Playbook" $10, pre-funded + pre-trustlined wallet, Filipino buyer persona. **Idempotent seeding** (upsert by email, handle multi-unique — audit #14) so re-running the seeder doesn't collide.
- **E2E isolation:** each e2e spec creates its own creator/product with a unique email (`beXXX-e2e+<timestamp>@kreav.test`) and cleans up in `afterAll`, so suites don't pollute each other.

---

## 24. CI Execution

```
pnpm install --frozen-lockfile
pnpm lint:check
pnpm build
pnpm prisma migrate deploy      # against CI Postgres service container
pnpm test --ci                  # unit (Jest, --ci flag for non-watch)
pnpm test:e2e                   # against migrated CI DB
# SonarCloud analysis (GitHub App)
```

**Why `--ci` (not `-- --ci`):** the `--` forwarding bug (BE-001) passed `--ci` as a test filename. Correct: `pnpm test --ci`.

**Timing budget:** the suite must stay under ~3 min in CI to keep PR feedback fast. Money-path tests get priority; nice-to-haves are trimmed if they bloat runtime.

---

## 25. Testing Folder Structure

```
backend/
├── src/
│   ├── products/products.service.spec.ts        ← unit (mocked)
│   ├── orders/orders.service.spec.ts             ← unit
│   ├── orders/order-state-machine.spec.ts        ← unit (pure)
│   ├── orders/webhook-signature.spec.ts          ← unit (pure crypto)
│   ├── common/serialization/...interceptor.spec.ts ← unit
│   └── events/event-log.listener.spec.ts         ← unit
├── test/
│   ├── products.e2e-spec.ts                      ← e2e (real DB)
│   ├── orders.e2e-spec.ts                        ← e2e (real DB)
│   ├── health.e2e-spec.ts                        ← e2e
│   └── database.e2e-spec.ts                      ← e2e
└── jest.config.ts / test/jest-e2e.json           ← configs
```

**Why co-located unit + separate e2e:** unit tests live next to the code they test (easy to find); e2e tests are a separate suite (different Jest config, different runtime needs — a real DB).

---

*Cross-reference: the flows being tested → **Kreav Sequence Diagram Bible**; the runtime under test → **Kreav Runtime Flow Bible**; CI/deploy → **Kreav Deployment PRD**.*
