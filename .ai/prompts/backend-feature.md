# Prompt: Backend Feature

> Reusable prompt for implementing a backend feature/issue.

---

You are implementing a Kreav backend feature (NestJS + Prisma + PostgreSQL). Issue: **[BE-XXX — <title>]**.

**Before coding, read:**
1. `AGENTS.md` — workflow (branch `be/<slug>` off `develop`, Conventional Commits, pragmatic TDD, never auto-merge).
2. `.ai/rules.md` + `.ai/architecture.md` — invariants + module map.
3. The issue's acceptance criteria.
4. The relevant `docs/architecture/Sequence-Diagram-Bible.md` sequence(s) for this flow.
5. `docs/api/API-Standards.md` + `docs/api/Error-Codes.md` (if touching endpoints).
6. `docs/database/Database-Bible.md` + `backend/prisma/schema.prisma` (if touching data).

**Apply:**
- One issue = one branch = one PR. Target `develop`.
- Conventional Commits: `<type>(<scope>): <desc> (BE-XXX)`.
- Money as `Prisma.Decimal`/decimal-string, never `number`. USDC = 7 decimals on-chain.
- Validate at the DTO boundary (`whitelist` + `forbidNonWhitelisted` + `transform`); services assume clean input.
- Order transitions through the state machine (`docs/architecture/Runtime-Flow-Bible.md`).
- Mirror — never recompute — any contract split output.
- Stellar: `getAccount → build → simulateTransaction → assembleTransaction → sign(platform key) → sendTransaction → poll getTransaction`. Trustline check before settle.
- Emit typed events from `src/events/event-payloads.ts`; notifications are async, non-blocking.
- Pragmatic TDD: write the behavior test with/before impl; unit (mocked Prisma/RPC) + e2e (real Postgres).

**Definition of Done:** `pnpm lint` clean · `pnpm build` succeeds · `pnpm test` green · acceptance criteria ticked · no secrets committed · money as Decimal · PR body has `closes #BE-XXX`.

**Never:** auto-merge; target `main`; ship a `feat` without its test; recompute a split; use float for money.

When done: push, open the PR to `develop`, watch CI to green, then **stop and hand off for human review**.
