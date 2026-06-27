# Code Review Checklist

> **Status:** The checklist every reviewer (human or AI) applies before approving a PR. The author also self-checks against this before requesting review.
> **Authoritative refs:** [Coding Standards](./Coding-Standards.md), [Security PRD](../security/Security-PRD.md), [Testing PRD](../backend/Testing-PRD.md), [AGENTS.md DoD](../../AGENTS.md).

---

## Universal (every PR)

- [ ] **CI green** (lint + build + unit + e2e + SonarCloud) — no green, no merge.
- [ ] **DoD met** ([Coding Standards §16](./Coding-Standards.md#16-definition-of-done-before-opening-a-pr)).
- [ ] **One issue = one PR**; PR body has `closes #X` + maps to acceptance criteria.
- [ ] **No secrets / `.env`** committed (only `.env.example`). Run the secret-grep check.
- [ ] **No debug code** left (console.log, dead branches, TODO-without-owner).
- [ ] **Conventional Commit** message with module scope + `(BE-XXX)`.
- [ ] **Documentation updated** if the change affects an API/schema/flow (link the relevant doc).

## Money & data integrity (any PR touching amounts/balances/settlement)

- [ ] **Money is `Decimal`/string, never `number`/`float`.** No `parseFloat`/`Number()` on money.
- [ ] **Fresh `Decimal` copies** when copying money between rows (no aliasing — BE-004 lesson).
- [ ] **Atomic writes** for money-consistent sets (Prisma `$transaction`).
- [ ] **No recomputation of a contract split** — the DB mirrors the contract's return value (ADR-006).
- [ ] **Idempotency respected** (`paymentRef` / `order_ref` / withdrawal intent).

## API / DTO

- [ ] **`whitelist` + `forbidNonWhitelisted` + `transform`** on the ValidationPipe (mass-assignment guard).
- [ ] **Money accepted as decimal string** (regex-validated), not JS number.
- [ ] **Pagination bounded** (`limit ≤ 100`), coerced via `@Type`.
- [ ] **Response shape matches** [API Standards](../api/API-Standards.md) (camelCase, money as string, `{data,page,limit,total}` for lists).
- [ ] **Error codes** match the [Error-Codes catalog](../api/Error-Codes.md); no ad-hoc `throw new HttpException()`.

## State & control flow

- [ ] **Order transitions** go through the [state machine](../architecture/Runtime-Flow-Bible.md#11-order-state-machine) — no illegal jumps; illegal → `INVALID_STATE_TRANSITION`.
- [ ] **Retries verify, never re-invoke** a successful settle (double-spend risk).
- [ ] **Event payloads** match the typed contracts in `events/event-payloads.ts`.
- [ ] **No blocking the business flow** on notifications (async via bus + NotificationLog).

## Security

- [ ] **No hardcoded credentials** anywhere.
- [ ] **Webhook HMAC** verified (timing-safe) before trusting the body.
- [ ] **`PLATFORM_WALLET_SECRET`** (if touched) is SettlementService-only, never logged.
- [ ] **Input validated at the boundary**; services assume clean input.
- [ ] **No SQL injection surface** (Prisma parameterized queries only).
- [ ] **Rate limits** on sensitive endpoints (checkout/webhook/withdraw).
- [ ] **OWASP API Top 10** spot-check (see [Security PRD §26](../security/Security-PRD.md)).

## Testing

- [ ] **Unit tests** for the new business logic (state transitions, money math, idempotency).
- [ ] **E2e happy path** + the key failure path for the endpoint.
- [ ] **Money tests assert Decimal values** (`.toFixed(2)`), not float equality.
- [ ] **Mocks at the client seam** (Prisma/RPC/Horizon/Resend), not deep in logic.
- [ ] **Regression test** for any fixed audit finding.
- [ ] **Coverage** on money/split/state paths ≥ 95%.

## Stellar integration (any PR touching RPC/Horizon/Soroban)

- [ ] **`simulateTransaction` → `assembleTransaction`** before submit (never raw invoke).
- [ ] **Poll `getTransaction`** until non-`NOT_FOUND`; check `SUCCESS`/`FAILED` explicitly.
- [ ] **Trustline check** before settling (else `op_no_trust`).
- [ ] **7-decimal USDC scaling** correct (DB `Decimal(18,2)` ↔ base units).
- [ ] **Explorer link / txHash** surfaced for the demo.

## Database / migrations

- [ ] **Migration committed** in `prisma/migrations/` (if schema changed).
- [ ] **No destructive migration** without explicit approval.
- [ ] **`@map` casing** preserved (camelCase field → snake_case column).
- [ ] **Index added** for any new query pattern.

---

## Reviewer red flags (auto-request-changes)

- A money field typed as `number` / `float`.
- A settlement recompute instead of a mirror.
- A missing `$transaction` around a money-consistent write.
- A `require_auth`-less privileged contract path (contract side).
- A logged secret.
- An illegal Order transition not guarded.

---

*Cross-reference: full standards → [Coding Standards](./Coding-Standards.md); security controls → [Security PRD](../security/Security-PRD.md).*
