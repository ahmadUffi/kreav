# Kreav Deployment PRD

> **Status:** Canonical deployment design for Kreav. Production-grade but **MVP-aligned** — no premature Kubernetes.
> **Targets:** self-hosted **VPS** running **Docker Compose** (backend + frontend + **Caddy**) · DB on **Neon** (managed Postgres) · Chain → Stellar Testnet.
> **Authority on conflict:** Architecture Consistency Check → Kreav Backend PRD v3.1 → this document.

---

## 1. Repository Structure

```
github.com/ahmadUffi/kreav          ← THE git repo (deployed by pulling on the VPS)
├── frontend/                        ← Next.js (standalone) → Docker image
├── backend/                         ← NestJS + Prisma      → Docker image
│   ├── prisma/{schema.prisma,migrations/}
│   ├── src/  test/  Dockerfile  .env(.example)
├── smartcontract/                   ← Soroban contracts (Rust) — deployed to Testnet
├── integration/                     ← contract integration tests (npm/tsx)
├── docs/                            ← PRDs / Bibles (this file included)
├── docker-compose.yml               ← production stack (backend + frontend + caddy)
├── Caddyfile                        ← reverse proxy + automatic HTTPS
└── .github/workflows/{ci,deploy}.yml
```

**Why this layout:** the repo is the deployable unit; the VPS checks it out and runs `docker compose up -d --build`. Docs live in-repo under `docs/`.

**Branch model:** `main` (default, stable — deploys), `develop` (integration). Feature branches `be/<slug>` / `fe/<slug>` / `bc/<slug>` off `develop`, PRs into `develop`, periodic `develop → main` promotions. Squash-merge.

---

## 2. Docker (Backend & Frontend)

Both apps ship a `Dockerfile` (`node:24-alpine`, multi-stage) and run as containers on the VPS.

**Backend design choices:**
- **Multi-stage build** — build with the full toolchain, run in a slim image (smaller attack surface, faster cold start).
- **pnpm** — single lockfile (`pnpm-lock.yaml`); `corepack enable` + `pnpm install --frozen-lockfile` for deterministic installs.
- **Build deps:** `prisma generate` runs in the build stage so the client is baked into the image.
- **Startup:** the container runs `pnpm prisma migrate deploy && node dist/main` — migrations apply against Neon before the server binds.

**Frontend design choices:**
- **npm** — single lockfile (`package-lock.json`); `npm ci` + `npm run build`.
- **Next standalone output** — the runtime stage copies `.next/standalone` and runs `node server.js` (no toolchain, no `node_modules` bloat).
- **`NEXT_PUBLIC_*` are build args** — `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_ANCHOR_ENABLED` are baked into the client bundle at build time (see `docker-compose.yml → frontend.build.args`). Changing them requires a rebuild.

**Why multi-stage:** a fat image ships the toolchain (tsc, prisma CLI) into prod, widening the attack surface and slowing deploys. Multi-stage keeps the runtime minimal.

---

## 3. Docker Compose (Production Stack)

`docker-compose.yml` is the **production** stack — there is **no Postgres service** (the DB is Neon, external). Deploy/update: `docker compose up -d --build`.

**Services:**
- **backend** — built from `./backend`; loads `backend/.env` via `env_file`; `PORT` overridden to `3000` (Caddy + healthcheck target 3000); healthcheck `GET /health`; explicit DNS (`8.8.8.8`, `1.1.1.1`) so container lookups to Neon/Stellar succeed.
- **frontend** — built from `./frontend` with build args `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ANCHOR_ENABLED` (from the root `.env`); exposes `3000`; `depends_on: backend`.
- **caddy** — `caddy:2-alpine`; publishes `80`/`443`; reads `APP_DOMAIN`/`API_DOMAIN`/`FUTURE_DOMAIN`/`ACME_EMAIL`; mounts `./Caddyfile`; persists certs in the `caddy-data` volume.

**Local dev** does not use this stack: run the backend with `pnpm start:dev` (hot reload) and the frontend with `npm run dev`, both pointing at the Neon dev database (or a local Postgres if you prefer). Only the deployed VPS runs compose.

---

## 4. Environment Variables

Two files feed the stack — **`backend/.env`** (`env_file` for the backend container) and the **root `.env`** (interpolated by docker-compose for build args + Caddy). Both are gitignored; `.env.example` templates live in git. See Runtime Flow Bible §9 for backend validation rules.

**Backend (`backend/.env`):**

| Variable | Required | Purpose | Owner |
|----------|----------|---------|-------|
| `DATABASE_URL` | ✅ | Postgres connection (postgresql:// URI) | **Neon** (managed) |
| `JWT_SECRET` | ✅ prod | Signs session JWTs (register + SEP-10 login) | secret (`backend/.env`) |
| `HORIZON_URL` | ✅ | Stellar Horizon endpoint (balance/explorer reads) | const (Testnet) |
| `SOROBAN_RPC_URL` | ✅ | Stellar RPC endpoint (contract invoke/verify) | const (Testnet) |
| `PLATFORM_WALLET_ADDRESS` | ✅ | Platform `G...` account (receives 5%, signs settlements; holds the pre-funded USDC float) | team-provisioned |
| `PLATFORM_WALLET_SECRET` | ✅ | Secret key `S...` — **sole server-side secret**; signs settlement txs (ADR H1, Stellar Standards ED-10) | secret (`backend/.env`) |
| `USDC_ASSET_CODE` / `USDC_ISSUER` | ✅ | `USDC` + Testnet issuer `G...` | const |
| `SPLIT_CONTRACT_ID` | ✅ | Deployed Revenue Split contract `C...` | BC team |
| `ANCHOR_ENABLED` (+ `ANCHOR_*` URLs) | — | SEP-24 off-ramp flag (Fase 2A); defaults to the SDF test anchor | ops |
| `RESEND_API_KEY` / `RESEND_FROM` | ⚠️ prod | Transactional email; `from` must be a verified-domain address | secret |
| `GCASH_WEBHOOK_SECRET` | ⚠️ prod | HMAC secret for `/webhooks/gcash` (optional in dev) | secret |
| `NODE_ENV` | ✅ prod | `production` | const |
| `PORT` | — | app default 3000 (compose pins 3000) | platform |

**Root `.env`** (docker-compose interpolation): `APP_DOMAIN`, `API_DOMAIN`, `FUTURE_DOMAIN`, `ACME_EMAIL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ANCHOR_ENABLED`, `EXPLORER_URL`.

**Per environment:** `development` (local `.env`, GCASH secret optional; platform secret local-only), `test` (CI, ephemeral Postgres service, secrets unset → escape hatch / mocked signing), `production` (VPS `.env` files, all secrets set).

**Platform USDC float (ADR C1):** the platform account is **pre-funded with testnet USDC** out-of-band (Implementation Backlog BC-011) because the buyer's GCash payment is mocked. Each settlement draws the float down ~−10 USDC. Before the demo, confirm the float covers expected volume; top up via the faucet if low (see Observability PRD for the low-float signal).

---

## 5. CI/CD

**Platform:** GitHub Actions. Two workflows:
- **`ci.yml`** (push/PR to `develop`/`main`) — runs against a `postgres:16` service container with **pnpm**:
  1. Setup pnpm 11 + Node 24
  2. `pnpm install --frozen-lockfile`
  3. `pnpm prisma:generate`
  4. `pnpm prisma migrate deploy` (CI Postgres)
  5. `pnpm lint:check`
  6. `pnpm build`
  7. (unit + e2e tests — currently gated/commented)
- **`deploy.yml`** (on `ci.yml` success for `main`) — SSHes to the VPS (`appleboy/ssh-action`) and runs: `git fetch origin main && git reset --hard origin/main && docker compose up -d --build && docker image prune -f`.

**Why this order:** lint/build fail fast and cheaply; migrate precedes tests so the e2e suite has a schema; e2e runs against a *real* Postgres service container so DB-layer bugs surface in CI. Deploy is gated on green CI.

**Security gates:** SonarCloud quality gate (⚠️ project key still stale `ahmadUffi_tipschain`); CodeQL upload needs an admin toggle (skipped); Dependabot/Renovate not yet enforced (audit #16).

---

## 6. Build & Deploy Pipeline

```
push → GitHub Actions ci.yml:
  install → prisma generate → migrate(deploy, CI PG) → lint:check → build → (test)
         ↓ (ci.yml success on main)
deploy.yml → SSH VPS → git reset --hard origin/main → docker compose up -d --build
         ↓ (backend container start)
  pnpm prisma migrate deploy (Neon) → node dist/main → Caddy routes traffic
```

**Why migrate in both CI and container start:** CI migrates to validate the migration applies cleanly against a fresh DB (catches drift). The backend container runs `migrate deploy` on start so the Neon schema matches the deployed code (no manual migration step).

---

## 7. Migration Strategy

**Tool:** Prisma Migrate. **Strategy:** `prisma migrate deploy` (non-interactive) in CI + on backend container start. **Never `db push`** in prod.

**Rules:**
- Every schema change ships a migration file in `prisma/migrations/` (reviewed in the PR).
- **No destructive migrations without explicit approval** — drops of populated tables are forbidden in MVP.
- Migrations are forward-only; rollback = a new forward migration that reverses (not `migrate reset` in prod).
- `@map` keeps DB columns snake_case while model fields are camelCase.

**Why forward-only:** prod data can't be reset. Reversals are explicit migrations so they're reviewed and auditable.

---

## 8. Prisma Migration Workflow

1. Edit `schema.prisma`.
2. `pnpm prisma migrate dev --name <change>` → generates + applies a migration locally.
3. Commit `migrations/<timestamp>_<name>/migration.sql` + updated `schema.prisma`.
4. CI + the backend container run `migrate deploy` → applies pending migrations in order.

**Why generate locally, apply in deploy:** the migration SQL is reviewed in the PR; CI and the container only *apply* (no generation in deploy, which could drift).

---

## 9. Secrets Management

| Secret type | Storage | Access |
|-------------|---------|--------|
| **DB credentials** | **Neon** dashboard → `DATABASE_URL` in `backend/.env` (gitignored) | backend container via `env_file` |
| **`JWT_SECRET`** | `backend/.env` on the VPS | AuthModule |
| **`GCASH_WEBHOOK_SECRET`** | `backend/.env` on the VPS | env only; never in repo |
| **Platform wallet secret (`PLATFORM_WALLET_SECRET`)** | `backend/.env` on the VPS; **never in git, never logged** — sole server-side secret (ADR H1, Stellar Standards ED-10) | SettlementService only |
| **Resend API key** | `backend/.env` on the VPS | Notification Module |
| **SSH deploy creds** | **GitHub Secrets** (`SSH_HOST`/`SSH_USER`/`SSH_KEY`/`DEPLOY_PATH`) | `deploy.yml` only |
| **Local dev** | `.env` (gitignored); `.env.example` is the template | developer machine |

**Rules:** `.env` files are gitignored (root + backend); `.env.example` holds placeholder keys. No secret in a commit, log, or error message. App secrets live in **files on the VPS** (injected via compose `env_file`/interpolation), not in GitHub — GitHub Secrets only hold SSH creds for deploy. The platform wallet key is the single highest-value secret — see Security PRD §"Platform Wallet Security".

---

## 10. Production Environment (VPS · Docker Compose · Caddy)

- **Host:** single self-hosted VPS running Docker + Docker Compose.
- **Services:** `backend`, `frontend`, `caddy` (see §3).
- **Database:** **Neon** managed PostgreSQL (external; not a compose service).
- **Container start:** backend runs `prisma migrate deploy` → then serves; Caddy routes once the backend healthcheck passes.
- **Health/readiness:** docker-compose healthcheck hits `GET /health`; a **deep check (`SELECT 1`)** is recommended so traffic isn't routed to a container whose DB isn't ready (audit #15).
- **Scaling:** single instance per service for MVP (modular monolith; no horizontal-scale need yet). See §21.

---

## 11. Development Environment

- Backend: `pnpm install` → `pnpm prisma migrate dev` → `pnpm start:dev` (hot reload), `DATABASE_URL` → Neon dev DB.
- Frontend: `npm install` → `npm run dev`.
- `.env` copied from `.env.example`; `GCASH_WEBHOOK_SECRET` may be empty (dev escape hatch).
- Unit tests: `pnpm test`; e2e (needs DB): `pnpm test:e2e`.

---

## 12. Test Environment (CI)

- GitHub Actions runner + `postgres:16` service container (ephemeral).
- `DATABASE_URL` points at the service container; `GCASH_WEBHOOK_SECRET` unset (escape hatch).
- Migrations applied via `migrate deploy` before e2e; destroyed after the run.

---

## 13. Health Check

`GET /health` → `{ status: "ok" }` (MVP shallow). **Recommended deep readiness:** a `SELECT 1` against Postgres (audit #15) so the compose healthcheck reflects DB connectivity. Splitting liveness (process up) from readiness (DB up) avoids killing a healthy process during a transient DB blip.

---

## 14. Monitoring

See **Kreav Observability PRD** for the full design. Deployment-relevant:
- Container stdout → captured by Docker; inspect with `docker compose logs -f` on the VPS.
- `/health` for uptime (compose healthcheck).
- RPC/Horizon/Resend availability + platform USDC float surfaced as metrics/alerts (Observability PRD).

---

## 15. Reverse Proxy & SSL

- **Caddy** (`caddy:2-alpine`) is the single edge: terminates TLS with **automatic HTTPS** (Let's Encrypt/ACME, `ACME_EMAIL`), and reverse-proxies `{$APP_DOMAIN}` → `frontend:3000` and `{$API_DOMAIN}` → `backend:3000` (gzip/zstd).
- **CORS:** `app.enableCors()` allows the frontend origin (`kreav.space` → `api.kreav.space` is cross-origin; without it the browser blocks calls — audit #4).

**Why Caddy:** automatic HTTPS with zero cert plumbing and a tiny config; one container fronts both apps. Domains are injected from env (`Caddyfile` hardcodes nothing).

---

## 16. Backups

- **DB:** **Neon** provides managed backups + point-in-time recovery / branching. **No custom backup scripts in MVP.**
- **Chain state:** immutable — no backup needed (it's the source of truth).
- **App config:** env vars live in `.env` files on the VPS + `.env.example` in git; Caddy certs persist in the `caddy-data` volume.

**Why rely on managed backups:** Neon's PITR is more reliable than cron'd `pg_dump`; building custom backup infra is out of MVP scope.

---

## 17. Rollback

**Strategy:** `git revert`/checkout the last-good commit on `main` and re-run `docker compose up -d --build` (the deploy step). DB rollbacks use forward-migrations (§7) — never `migrate reset`.

**Why redeploy from git:** the VPS builds images from the checked-out source, so the running artifact is defined by the `main` commit; reverting `main` and rebuilding restores the last-good state. If a migration accompanied the bad deploy, a forward-reversal migration ships next.

**Limitation:** a migration that *dropped* a column can't be rolled back without data loss — which is why destructive migrations are forbidden (§7).

---

## 18. Deployment Strategy

**MVP: rebuild-in-place.** `docker compose up -d --build` recreates changed containers; the old container receives SIGTERM → graceful shutdown (Runtime Flow Bible §16), the new one starts after its build. Brief downtime per service is acceptable for the demo.

**Why not blue/green or canary in MVP:**
- **Blue/green** doubles instances and needs routing config — unjustified for a single-VPS demo.
- **Canary** needs traffic-splitting infra — overkill for the demo's volume.
- Rebuild-in-place + healthcheck gate + git-revert rollback covers the demo's reliability needs. Documented as future options (§19–20).

---

## 19. Blue/Green Discussion (Future)

**When to adopt:** zero-downtime SLAs, or when a bad deploy must be instantly reversible without a rebuild window. **Cost:** 2× instances + a router (Caddy can swap upstreams) that flips `blue`/`green`. **For Kreav post-MVP:** justified only if the platform goes multi-tenant with uptime requirements.

---

## 20. Canary Discussion (Future)

**When to adopt:** risky changes (new settlement logic) where you want to route 5% traffic, observe, then ramp. **Needs:** traffic-splitting + good observability to judge the canary. **For Kreav post-MVP:** a real canary would need the Observability PRD's metrics/alerts in place first.

---

## 21. Container Lifecycle & Scaling

**MVP: single instance per service.** The NestJS modular monolith is stateless (DB holds state; in-process caches are non-essential). If scaled horizontally:

| Concern | Horizontal-scale implication |
|---------|------------------------------|
| **Event bus** (`@nestjs/event-emitter`) | In-process → events don't cross instances. **Needs Redis pub/sub or a queue** if N>1. |
| **Throttler storage** | In-memory → per-instance limits. **Needs Redis store** for global limits. |
| **Cron/scheduled jobs** | Multiple instances → duplicate cron fires. **Needs a distributed lock or single-worker election.** |
| **Sessions** | Stateless JWT (no server sessions) → safe. |

**Future Kubernetes notes:** K8s is **not** MVP. It becomes attractive when: multi-region, autoscaling, or complex routing. Migration path: containerize (already Docker), add Redis for bus/throttler/cron-lock, then HPA on CPU/RPS. Until then, a single VPS with Docker Compose + Caddy + managed Neon Postgres is the right-size tool.

---

*Cross-reference: what runs after deploy → **Kreav Runtime Flow Bible**; how it's tested before deploy → **Kreav Testing PRD**; observing it in prod → **Kreav Observability PRD**; securing the platform key → **Kreav Security PRD**.*
