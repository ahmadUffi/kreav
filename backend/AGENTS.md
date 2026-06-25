# Backend Working Agreement

> Source of truth for how backend issues (BE-001 → BE-012) are executed.
> Bind to PRD: `Kreav Backend PRD.md` v3 (Final). Scope: **backend only**.

## Issue lifecycle

```
Backlog → [create branch] → In progress → [open PR → develop] → In review → [CI green?] → [squash merge] → Done
```

- **One issue = one branch = one PR.**
- **Base branch = `develop`** (NOT `main`). `develop` is the working source of truth; `main` is only touched via deliberate releases.
- Move the Project #10 card at each phase so the board stays accurate.
- Issue auto-closes on merge via `closes #X` in the PR body.
- `Source of truth: Kreav Backend PRD.md` → always obey; it wins over other docs.

## Branching

- Branch off `develop`: `be/<kebab-slug-describing-the-issue>`
  - e.g. `be/initialize-backend-project`, `be/checkout-apis`, `be/core-entities`
- One branch per issue. Delete the branch after merge.

## Commits — Conventional Commits + module scope + issue ID

```
<type>(<scope>): <short description> (BE-XXX)
```

- **Types:** `feat`, `fix`, `chore`, `test`, `refactor`, `docs`, `ci`
- **Scopes (module names):** `config`, `prisma`, `products`, `orders`, `wallets`, `stellar`, `auth`, `users`, `common`
- Examples:
  - `feat(orders): create checkout endpoint (BE-005)`
  - `test(orders): checkout→webhook happy path (BE-005)`
  - `chore(prisma): add User/Product schema migration (BE-003)`
- Commit small and often on the branch. Final squash on merge produces one clean main commit.

## TDD style — Pragmatic

- **Always write tests** for real business logic: state transitions (`PENDING→PAID→SETTLING→SETTLED`), idempotency, validation, money math, payload contracts.
- **e2e happy-path** for each endpoint (Supertest against the Nest app).
- No need for red-green on pure getters/DTOs/mappers — those are covered by e2e.
- Tests live beside the code: `*.service.spec.ts`, `e2e/*.e2e-spec.ts`.
- Intent: write the logic test *with or just before* the implementation; never ship a `feat` without its test.

## Definition of Done (before opening a PR)

All must be true:
- [ ] `pnpm lint` clean
- [ ] `pnpm build` succeeds
- [ ] `pnpm test` green
- [ ] Every acceptance-criteria checkbox in the issue is ticked
- [ ] No secrets / `.env` committed (only `.env.example`)
- [ ] Money handled as Decimal/string, never float
- [ ] PR body includes `closes #X` + maps changes to the issue's acceptance criteria

## CI — GitHub Actions

- `.github/workflows/ci.yml` runs on every PR and on `develop`: `pnpm install` → `lint` → `build` → `test`.
- **The AI agent (and any human) MUST verify CI is green before merging a PR.** No green CI = no merge — even if local checks pass. If CI is red, fix the branch and re-run; do not bypass.
- PR target is `develop`. Enable branch protection on `develop` (require CI checks) when the repo owner is ready.

## Merge strategy — Squash & merge

- Squash all branch commits → **one commit on `develop`** with a clean conventional message.
- Use the issue number + title in the squashed message (e.g. `feat(config): initialize NestJS backend project (BE-001) (#1)`).
- **Merge gate:** CI must be green on the PR head before squash-merging. Re-check CI after merge to `develop`.
- Delete the source branch after merge.
- `main` is updated only via deliberate releases from `develop` — not from feature branches.

## Local environment

- `docker compose up -d` → PostgreSQL
- `.env` local (gitignored), `.env.example` committed
- Backend config via the Config Module (`@nestjs/config`) with fail-fast validation.
- All work happens under `backend/`.

## Non-negotiables (from PRD)

- **Non-custodial:** store only the public key. Never secret keys / seed phrases — not in DB, not in logs, not in code.
- **No mocking real value:** Stellar account, trustline, USDC, Soroban invocation, txHash, wallet balance must be real on Testnet. Only GCash/bank/anchor/KYC may be mocked.
- **PostgreSQL = app state, Stellar = settlement state.** Don't duplicate balances in the DB.
- **Every blockchain action must be visible** (txHash + explorer link).
