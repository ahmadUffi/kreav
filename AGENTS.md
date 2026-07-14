# Kreav — Working Agreement & Project Memory

> Source of truth for any contributor or AI agent working in this repo. Read this first.

## What is Kreav

**Kreav** is a programmable settlement layer for digital product creators, powered by Stellar.
It is **not** a marketplace/social platform — it only handles payment settlement + payout infrastructure.

**Hackathon:** APAC Stellar Hackathon 2026 — Track 3: Payment Consumer Applications.
**Goal:** Ship a ~3 min demo where a buyer purchases a digital product → Soroban splits revenue 95% creator / 5% platform → creator receives USDC in a Stellar wallet → verifies on-chain → withdraws.

### One-line demo
A buyer (Philippines) pays 10 USDC for a digital product → Soroban contract splits → 9.50 USDC to Indonesian creator / 0.50 USDC to platform → creator withdraws.

## Repository layout

```
kreav/                          ← THE git repo: github.com/ahmadUffi/kreav
├── backend/                    ← NestJS + Prisma + PostgreSQL (modular monolith)
├── frontend/                   ← Next.js (App Router) + Tailwind; API client in src/lib/api
├── smartcontract/              ← Soroban revenue-split contract (Rust) — src/lib.rs + src/test.rs
├── integration/                ← TS end-to-end scripts that exercise the deployed contract on Testnet
├── docs/                       ← Engineering Bible (all documentation, see README)
├── compose.yml                 ← local PostgreSQL (Neon is used for hosted dev — see backend/.env)
├── .env.example                ← environment variable template
├── AGENTS.md                   ← this file (canonical working agreement)
└── README.md                   ← project entry point
```

- The git repo lives at the repo root. Run git commands here.
- All documentation lives in `docs/` (organized by domain). See [README.md](./README.md) for the full documentation map + reading order.
- `backend/AGENTS.md` mirrors the backend section of this file; **this canonical copy wins** on any conflict.

### Backend module map (`backend/src/`)

NestJS modular monolith. Each module = one bounded context; tests live beside the code (`*.spec.ts`, e2e in `backend/test/`).

| Module | Responsibility | Key HTTP surface |
|--------|----------------|------------------|
| `products/` | Product catalog + collaborators | `GET/POST /products`, `GET /products/:id` |
| `orders/` | Checkout + GCash webhook + order reads | `POST /checkout`, `POST /webhooks/gcash`, `GET /orders`, `GET /orders/:id` |
| `wallets/` | Connect wallet, balance & tx reads | `POST /wallet/connect`, `GET /wallet/balance`, `GET /wallet/transactions` |
| `withdrawals/` | Creator payout requests | `POST /withdrawals`, `GET /withdrawals`, `GET /withdrawals/:id` |
| `users/` | Creator profiles + username check | `GET/PATCH /users/me`, `GET /users/check-username`, `GET /users/:username/profile` |
| `site/` | Creator mini-site config | `GET/PUT /users/me/site` |
| `analytics/` | Dashboard metrics | `GET /analytics` |
| `auth/` | Registration (future: SEP-10) | `POST /auth/register` |
| `stellar/` | **Internal** — Horizon reads, Soroban settlement, platform keypair, float monitor, explorer links | — |
| `events/` | In-process event bus (`payment.received`, `settlement.completed`) | — |
| `prisma/` | `PrismaService` (DB access) | — |
| `common/` | Health endpoint, startup recovery, filters/interceptors | `GET /health` |

Settlement is event-driven: `orders` emits `payment.received` → `stellar/settlement.service` invokes the Soroban contract → records the result and emits `settlement.completed`. The full API contract is the live **Swagger** (`/api` when the server runs); treat it as the source of truth over this table.

### Smart contract (`smartcontract/src/lib.rs`)

Soroban revenue-split contract (Rust). Public functions: `initialize(platform_wallet, usdc_sac)`, `settle(order_ref, total, recipients)`, `is_settled(order_ref)`, `get_version()`. Deployed to Testnet; the backend invokes it via `SPLIT_CONTRACT_ID`. **In scope to call, not to rewrite** (see agent scope below).

### Integration suite (`integration/`)

Standalone TypeScript scripts (`scripts/01-…` → `99-acceptance.ts`) that drive the deployed contract on Testnet directly (version, initialize check, single/multi settlement, idempotency, validation errors, balances, events). Has its own `package.json` + `.env` (`CONTRACT_ID`, `USDC_SAC`, platform/creator keys). Used to validate the contract independently of the backend.

## Key documents (new locations)

| Doc | Path | Purpose |
|-----|------|---------|
| Product Scope | [`docs/product/Product-Scope.md`](./docs/product/Product-Scope.md) | MVP scope, features, demo flow, non-goals |
| System Architecture | [`docs/architecture/System-Architecture.md`](./docs/architecture/System-Architecture.md) | System architecture (mermaid), money & event flows |
| Backend PRD | [`docs/backend/Backend-PRD.md`](./docs/backend/Backend-PRD.md) | NestJS module design, DB schema, API spec |
| Implementation Backlog | [`docs/backend/Implementation-Backlog.md`](./docs/backend/Implementation-Backlog.md) | Sprint plan: FE/BE/BC tasks with priorities & effort |
| Demo PRD | [`docs/product/Demo-PRD.md`](./docs/product/Demo-PRD.md) | Screen-by-screen demo script + timing |
| Stellar Standards PRD | [`docs/stellar/Stellar-Standards-PRD.md`](./docs/stellar/Stellar-Standards-PRD.md) | Stellar standards, protocols, SDKs, decisions |
| Soroban Contract PRD | [`docs/stellar/Soroban-Contract-PRD.md`](./docs/stellar/Soroban-Contract-PRD.md) | Revenue Split contract specification |
| Anchor PRD | [`docs/stellar/Anchor-PRD.md`](./docs/stellar/Anchor-PRD.md) | Fiat on-ramp/off-ramp architecture |
| Security PRD | [`docs/security/Security-PRD.md`](./docs/security/Security-PRD.md) | Threat model, trust boundaries, controls |
| Security Audit | [`docs/security/Security-Audit.md`](./docs/security/Security-Audit.md) | Security & reliability audit findings + status |
| Final Architecture Review | [`docs/reviews/Final-Architecture-Review.md`](./docs/reviews/Final-Architecture-Review.md) | Final ADR + verdict |

## Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js + Tailwind CSS |
| Backend | NestJS (modular monolith) |
| DB | PostgreSQL via Prisma ORM |
| Blockchain | Stellar (Soroban RPC primary; Horizon for balances/explorer) |
| Smart contract | Soroban (Rust) — revenue-split contract only |
| Asset | USDC on Stellar Testnet (classic asset via the SAC bridge; SAC `CBIELTK6…`) |
| Deployment | Frontend→Vercel, Backend→Railway, DB→Neon (managed Postgres, dev), chain→Stellar Testnet |

## Source of truth & authority hierarchy

1. **Official Stellar documentation (skills.stellar.org)** — wins on Stellar mechanics.
2. **[Architecture Consistency Check](./docs/reviews/Architecture-Consistency-Check.md)** — wins on cross-document consistency.
3. **[Backend PRD](./docs/backend/Backend-PRD.md) v3 + v3.1 addendum** — the single source of truth for the application layer and data model. When other docs conflict, the Backend PRD wins.
4. Older documents lose.

**Wallet strategy = Non-Custodial (DECIDED).** Creator connects their own Freighter/Lobstr wallet; the backend stores only the public key. The backend never holds funds, never stores private keys / seed phrases, never does wallet custody.

**Agent scope = BACKEND ONLY** (NestJS + Prisma + PostgreSQL). Not frontend, not the Soroban smart-contract source itself. The Stellar integration (Horizon queries + Soroban invocation) lives in the backend as an internal module — so *calling* Horizon/Soroban from NestJS is in scope; *writing* the contract is not.

## Core architecture principles

1. **Stellar = settlement layer.** Soroban is used *only* for programmable revenue split.
2. **PostgreSQL = application state** (users, products, orders, transaction records).
3. **Blockchain = settlement state** (balances, trustlines, split tx).
4. **Buyers never touch blockchain.** Creators never need crypto knowledge.
5. Every blockchain action must be *visible in the demo* (tx hash, explorer link).

## Data model & API surface

- Core entities: **User, Product, ProductCollaborator, Order, Settlement, SettlementRecipient, Wallet, Withdrawal, NotificationLog**
- Profile/mini-site entities: **SocialLink, CustomLink, FeaturedProduct** (creator public profile + mini-site config)
- **Order.status:** 13-state machine (v3.1 §20): `CREATED → ... → WITHDRAW_COMPLETED` + failure states (`PAYMENT_FAILED`, `SETTLEMENT_FAILED`, `WITHDRAW_FAILED`, `WAITING_WALLET`, `CANCELLED`)
- **Settlement:** 1 canonical row + N SettlementRecipient children
- API surface: see the Backend module map above (or the live Swagger at `/api`).

See the [Backend PRD](./docs/backend/Backend-PRD.md) for the full spec.

## Environment variables (Backend)

```
DATABASE_URL=
HORIZON_URL=
SOROBAN_RPC_URL=
PLATFORM_WALLET_ADDRESS=
PLATFORM_WALLET_SECRET=   # sole server-side secret; signs settlements
USDC_ASSET_CODE=
USDC_ISSUER=
SPLIT_CONTRACT_ID=
GCASH_WEBHOOK_SECRET=     # optional in dev; REQUIRED for on-stage demo
RESEND_API_KEY=          # optional in dev (emails logged, not sent); set to deliver product links
RESEND_FROM=             # from-address for outgoing email; defaults to Resend shared sender
DEMO_MODE=               # true → exposes POST /orders/:id/simulate-payment; off in production
```

## Backend working agreement

> Bind to PRD: [`docs/backend/Backend-PRD.md`](./docs/backend/Backend-PRD.md) v3 (Final). Scope: **backend only**.

### Issue lifecycle

```
Backlog → [create branch] → In progress → [open PR → develop] → In review → [CI green?] → [USER reviews & merges] → Done
```

- **One issue = one branch = one PR.**
- **Base branch = `develop`** (NOT `main`). `develop` is the working source of truth; `main` is only touched via deliberate releases.
- Move the Project #10 card at each phase so the board stays accurate.
- Issue auto-closes on merge via `closes #X` in the PR body (note: GitHub auto-close does NOT fire for PRs into `develop`; close manually after merge).
- `Source of truth: docs/backend/Backend-PRD.md` → always obey; it wins over other docs.

### Branching

- Branch off `develop`: `be/<kebab-slug-describing-the-issue>`
  - e.g. `be/initialize-backend-project`, `be/checkout-apis`, `be/core-entities`
- One branch per issue. Delete the branch after merge.

### Commits — Conventional Commits + module scope + issue ID

```
<type>(<scope>): <short description> (BE-XXX)
```

- **Types:** `feat`, `fix`, `chore`, `test`, `refactor`, `docs`, `ci`
- **Scopes (module names):** `config`, `prisma`, `products`, `orders`, `wallets`, `withdrawals`, `stellar`, `auth`, `users`, `site`, `analytics`, `events`, `common`
- Examples:
  - `feat(orders): create checkout endpoint (BE-005)`
  - `test(orders): checkout→webhook happy path (BE-005)`
  - `chore(prisma): add User/Product schema migration (BE-003)`
- Commit small and often on the branch. Final squash on merge produces one clean main commit.

### TDD style — Pragmatic

- **Always write tests** for real business logic: state transitions, idempotency, validation, money math, payload contracts.
- **e2e happy-path** for each endpoint (Supertest against the Nest app).
- No need for red-green on pure getters/DTOs/mappers — those are covered by e2e.
- Tests live beside the code: `*.service.spec.ts`, `e2e/*.e2e-spec.ts`.
- Intent: write the logic test *with or just before* the implementation; never ship a `feat` without its test.

### Definition of Done (before opening a PR)

All must be true:
- [ ] `pnpm lint` clean
- [ ] `pnpm build` succeeds
- [ ] `pnpm test` green
- [ ] Every acceptance-criteria checkbox in the issue is ticked
- [ ] No secrets / `.env` committed (only `.env.example`)
- [ ] Money handled as Decimal/string, never float
- [ ] PR body includes `closes #X` + maps changes to the issue's acceptance criteria

### CI — GitHub Actions

- `.github/workflows/ci.yml` runs on every PR and on `develop`: `pnpm install` → `lint` → `build` → `test`.
- **The AI agent (and any human) MUST verify CI is green before merging a PR.** No green CI = no merge — even if local checks pass. If CI is red, fix the branch and re-run; do not bypass.
- PR target is `develop`. Enable branch protection on `develop` (require CI checks) when the repo owner is ready.

### Merge strategy — Squash & merge (NEVER auto-merge)

> ⛔ **The AI agent MUST NEVER merge a PR by itself.** After CI goes green, the
> agent opens/leaves the PR open and asks the **user to review and merge**.
> CI green is a *prerequisite*, not a trigger. No review = no merge.

- Workflow: agent opens PR → watches CI until green → **stops and notifies the user** → user reviews & squash-merges.
- Squash all branch commits → **one commit on `develop`** with a clean conventional message.
- Use the issue number + title in the squashed message (e.g. `feat(config): initialize NestJS backend project (BE-001) (#1)`).
- After the user merges, the agent closes the issue + moves the Project #10 card manually.
- Delete the source branch after merge.
- `main` is updated only via deliberate releases from `develop` — not from feature branches.

### Secrets & configuration — no hard-coding

- **Never hard-code credentials** (DB passwords, API keys, wallet keys, secrets). Read everything from env via `process.env` / `@nestjs/config` / `${VAR}` interpolation.
- The **only** exception: GitHub Actions `env:` / service-container blocks, where dummy local-only values are the documented standard pattern (CI VMs are ephemeral). Real secrets there must use GitHub Secrets (`secrets.*`), never literals.
- `compose.yml` reads from `.env` via interpolation — no literals.
- `.env` is gitignored everywhere (root + `backend/`). Only `.env.example` (placeholders) is committed.
- Non-custodial: never store private keys / seed phrases anywhere — not env, not DB, not logs. (The sole exception is `PLATFORM_WALLET_SECRET`, the platform account's signing key — held server-side only, never logged. See the [Security PRD](./docs/security/Security-PRD.md) §16.)

### Local environment

- `docker compose up -d` → PostgreSQL
- `.env` local (gitignored), `.env.example` committed
- Backend config via the Config Module (`@nestjs/config`) with fail-fast validation.
- All work happens under `backend/`.

## Non-negotiables

- **Non-custodial:** store only the public key. Never secret keys / seed phrases — not in DB, not in logs, not in code.
- **No mocking real value:** Stellar account, trustline, USDC, Soroban invocation, txHash, wallet balance must be real on Testnet. Only GCash/bank/anchor/KYC may be mocked.
- **PostgreSQL = app state, Stellar = settlement state.** Don't duplicate balances in the DB.
- **Every blockchain action must be visible** (txHash + explorer link).

## CI / security tooling (DECIDED)

- **SonarCloud** — active on every PR. Primary code-quality + security scanner. ✅
- **CodeQL** — scan runs on this private repo, but **uploading results needs the "Code scanning" repo feature enabled, which requires admin (owner = ahmadUffi).** The agent (Maulana-anjari) only has push+triage, NOT admin. **Skipping CodeQL for now**; revisit when the toggle is enabled or the repo goes public. Don't re-attempt without confirming the toggle is on.
- **SonarCloud project key** is stale (`ahmadUffi_tipschain`); the owner should rename it to `ahmadUffi_kreav`.
- **Repo access:** Maulana-anjari has push+triage, NOT admin. Anything needing repo Settings (branch protection, feature toggles, secrets config) must go through ahmadUffi.

## Working with this repo

- This is a hackathon: optimize for a working, demonstrable end-to-end flow over polish/completeness.
- Follow the Implementation Backlog sprint order: infra (Sprint 1) → purchase→settlement (Sprint 2) → wallet/withdrawal (Sprint 3) → demo hardening (Sprint 4).
- When in doubt about scope, re-read the "Demo Failure Conditions" in the [Demo PRD](./docs/product/Demo-PRD.md): no long loads, no wallet setup on stage, no blockchain jargon.
