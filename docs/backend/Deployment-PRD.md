# Kreav Deployment PRD

> **Status:** Canonical deployment design for Kreav. Production-grade but **MVP-aligned** — no premature Kubernetes.
> **Targets:** Frontend → Vercel · Backend + DB → Railway · Chain → Stellar Testnet (Backend PRD §15).
> **Authority on conflict:** Architecture Consistency Check → Kreav Backend PRD v3.1 → this document.

---

## 1. Repository Structure

```
Kreav/                              ← working dir (planning docs, NOT a git repo)
├── *.md                            ← PRDs / Bibles (this file included)
└── KREAV-app/                      ← THE git repo: github.com/ahmadUffi/kreav
    ├── frontend/                   ← Next.js + Tailwind  → Vercel
    ├── backend/                    ← NestJS + Prisma     → Railway
    │   ├── prisma/
    │   │   ├── schema.prisma
    │   │   └── migrations/
    │   ├── src/
    │   ├── test/
    │   ├── Dockerfile
    │   ├── compose.yml             ← local DB
    │   ├── .env.example
    │   └── sonar-project.properties
    └── smartcontract/             ← Soroban contracts (Rust) — deployed to Testnet
```

**Why this layout:** the git repo is the deployable unit; planning docs live one level up so they don't pollute the build context.

**Branch model:** `main` (default, stable), `develop` (integration). Feature branches `be/<slug>` / `fe/<slug>` / `bc/<slug>` off `develop`, PRs into `develop`, periodic `develop → main` promotions. Squash-merge.

---

## 2. Docker (Backend)

The backend ships a `Dockerfile` for Railway (Railway can build from a Dockerfile or a Nixpacks auto-detect; an explicit Dockerfile is more deterministic).

**Design choices:**
- **Multi-stage build** — build with the full Node image, run in a slim image (smaller attack surface, faster cold start).
- **Non-root user** — the runtime container does not run as root.
- **pnpm** — single lockfile (`pnpm-lock.yaml`); deterministic installs.
- **Build deps:** `prisma generate` runs in the build stage so the client is baked into the image.
- **No source maps leak** — production build strips debug info where possible.

**Why not a single-stage image:** a fat image ships the toolchain (tsc, prisma CLI) into prod, widening the attack surface and slowing deploys. Multi-stage keeps the runtime minimal.

---

## 3. Docker Compose (Local Dev)

`compose.yml` runs **PostgreSQL only** (`postgres:16-alpine`). It reads `POSTGRES_*` from `.env` via interpolation — **no hardcoded credentials** (audit fix). The backend itself runs via `pnpm start:dev` (hot reload), not in a container.

**Why Postgres-in-compose, app-on-host:** hot reload + debugger attach work natively; only the stateful dependency (DB) needs containerization. Spinning the app in Docker locally slows the dev loop.

```yaml
# shape (values via .env interpolation, not hardcoded)
services:
  kreav-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
volumes:
  pgdata:
```

---

## 4. Environment Variables

Authoritative list (Backend PRD §15 + the v3.1/Stellar revisions). See Runtime Flow Bible §9 for validation rules.

| Variable | Required | Purpose | Owner |
|----------|----------|---------|-------|
| `DATABASE_URL` | ✅ | Postgres connection (postgresql:// URI) | Railway DB |
| `HORIZON_URL` | ✅ | Stellar Horizon endpoint (balance/explorer reads) | const (Testnet) |
| `SOROBAN_RPC_URL` | ✅ | Stellar RPC endpoint (contract invoke/verify) | const (Testnet) |
| `PLATFORM_WALLET_ADDRESS` | ✅ | Platform `G...` account (receives 5%, signs settlements; holds the pre-funded USDC float) | team-provisioned |
| `PLATFORM_WALLET_SECRET` | ✅ | Secret key `S...` for the platform account — **sole server-side secret**; signs settlement txs (ADR H1, Stellar Standards ED-10) | secret (Railway) |
| `USDC_ASSET_CODE` | ✅ | `USDC` | const |
| `USDC_ISSUER` | ✅ | Circle Testnet USDC issuer `G...` | const |
| `SPLIT_CONTRACT_ID` | ✅ | Deployed Revenue Split contract `C...` | BC team |
| `GCASH_WEBHOOK_SECRET` | ⚠️ prod | HMAC secret for `/webhooks/gcash` (optional in dev) | secret |
| `NODE_ENV` | ✅ prod | `production` | const |
| `PORT` | — | defaults 3000 | platform |

**Per environment:** `development` (local `.env`, GCASH secret optional; platform secret local-only), `test` (CI, ephemeral Postgres, secrets unset → escape hatch / mocked signing), `production` (Railway, all secrets set: GCASH + `PLATFORM_WALLET_SECRET`).

**Platform USDC float (ADR C1):** the platform account is **pre-funded with testnet USDC** out-of-band (Implementation Backlog BC-011) because the buyer's GCash payment is mocked. Each settlement draws the float down ~−10 USDC. Before the demo, confirm the float covers the expected volume; top up via the faucet if low (see Observability PRD for the low-float signal).

---

## 5. CI/CD

**Platform:** GitHub Actions (`.github/workflows/ci.yml`). SonarCloud analysis runs via its GitHub App.

**Pipeline stages (per push/PR):**
1. **Install** (`pnpm install --frozen-lockfile`)
2. **Lint** (`pnpm lint:check`)
3. **Build** (`pnpm build`)
4. **Migrate** (`prisma migrate deploy` against the CI Postgres service container)
5. **Test** (`pnpm test --ci` unit + `pnpm test:e2e` against the migrated CI DB)

**Why this order:** lint/build fail fast and cheaply; migrate must precede test so the e2e suite has a schema; e2e runs against a *real* Postgres service container (not mocked) so DB-layer bugs surface in CI.

**Security gates:**
- **SonarCloud** — quality gate on every PR (primary scanner). ⚠️ Known config issue: the project key is the stale `ahmadUffi_tipschain`; PR-scoped analysis mis-rates until the owner renames it (Architecture Consistency Check).
- **CodeQL** — scan runs, but *uploading* results needs a repo feature toggle requiring admin (owner = ahmadUffi). Skipped for now (audit/AGENTS.md).
- **Dependabot/Renovate** — not yet enforced; audit #16 recommends a major-version bump check.

**Deploy trigger:** `develop` → Railway (auto-deploy on push). `main` → production promo (manual gate).

---

## 6. Build Pipeline

```
push → GitHub Actions:
  install → lint → build → migrate(deploy) → test(unit) → test(e2e) → SonarCloud
         ↓ (on develop)
Railway: build Dockerfile → prisma migrate deploy → release → health-check → live
```

**Why migrate in both CI and release:** CI migrates to validate the migration applies cleanly against a fresh DB (catches drift). Railway runs `migrate deploy` in the release phase so the schema matches the code version being deployed (no manual migration step).

---

## 7. Migration Strategy

**Tool:** Prisma Migrate. **Strategy:** `prisma migrate deploy` (non-interactive) in CI + Railway release phase. **Never `db push`** in prod.

**Rules:**
- Every schema change ships a migration file in `prisma/migrations/` (reviewed in the PR).
- **No destructive migrations without explicit approval** — drops of populated tables are forbidden in MVP.
- Migrations are forward-only; rollback = a new forward migration that reverses (not `migrate reset` in prod).
- The schema's `@map` convention keeps DB columns snake_case while model fields are camelCase — **no migration needed for the casing refactor** (BE-004), since `@map` targets are unchanged.

**Why forward-only:** prod data can't be reset. Reversals are explicit migrations so they're reviewed and auditable.

---

## 8. Prisma Migration Workflow

1. Edit `schema.prisma`.
2. `pnpm prisma migrate dev --name <change>` → generates + applies a migration locally.
3. Commit `migrations/<timestamp>_<name>/migration.sql` + updated `schema.prisma`.
4. CI/Railway run `migrate deploy` → applies pending migrations in order.

**Why generate locally, apply in CI:** the migration SQL is reviewed in the PR; CI/Railway only *apply* (no generation in deploy, which could drift).

---

## 9. Secrets Management

| Secret type | Storage | Access |
|-------------|---------|--------|
| **DB credentials** | Railway (managed Postgres) | injected as `DATABASE_URL` |
| **`GCASH_WEBHOOK_SECRET`** | Railway variable (encrypted at rest) | env only; never in repo |
| **Platform wallet secret key (`PLATFORM_WALLET_SECRET`)** | **Server-side only**, Railway variable (encrypted at rest); **never in git, never logged** — the sole server-side secret (ADR H1, Stellar Standards ED-10) | SettlementService only |
| **Resend API key** | Railway variable | Notification Module |
| **Local dev** | `.env` (gitignored); `.env.example` is the template | developer machine |

**Rules:** `.env` is gitignored (root + backend). `.env.example` holds keys with placeholder values. No secret ever appears in a commit, log, or error message. The platform wallet key is the single highest-value secret — see Security PRD §"Platform Wallet Security".

---

## 10. Production Environment (Railway)

- **Service:** backend (built from `Dockerfile`).
- **Database:** Railway managed PostgreSQL 16.
- **Release phase:** `prisma migrate deploy` → then health check → then traffic.
- **Health/readiness:** Railway probes `/health`; **deep check (`SELECT 1`) recommended** so Railway doesn't route to a container whose DB isn't ready (audit #15).
- **Region:** closest to the demo audience; Testnet RPC latency is the real bottleneck.
- **Scaling:** single instance for MVP (modular monolith; no horizontal-scale need yet). See §21.

---

## 11. Development Environment

- `docker compose up -d kreav-db` → Postgres.
- `pnpm install` → `pnpm prisma migrate dev` → `pnpm start:dev` (hot reload).
- `.env` copied from `.env.example`; `GCASH_WEBHOOK_SECRET` may be empty (dev escape hatch).
- Unit tests: `pnpm test`; e2e (needs DB running): `pnpm test:e2e`.

---

## 12. Test Environment (CI)

- GitHub Actions runner + `postgres:16` service container.
- Env: `DATABASE_URL` pointed at the service container; `GCASH_WEBHOOK_SECRET` unset (escape hatch).
- Migrations applied via `migrate deploy` before e2e.
- Ephemeral — destroyed after the run; no persistent state.

---

## 13. Health Check

`GET /health` → `{ status: "ok" }` (MVP shallow). **Recommended deep readiness:** include a `SELECT 1` against Postgres (audit #15) so Railway's readiness probe reflects DB connectivity. A separate liveness (process up) vs readiness (DB up) split avoids killing a healthy process during a transient DB blip.

---

## 14. Monitoring

See **Kreav Observability PRD** for the full design. Deployment-relevant:
- Railway log drain → structured logs (Runtime Flow Bible emits them).
- `/health` for uptime.
- RPC/Horizon/Resend availability surfaced as metrics/alerts (Observability PRD).

---

## 15. Reverse Proxy & SSL

- **Frontend (Vercel):** Vercel terminates TLS + CDN.
- **Backend (Railway):** Railway provides a TLS-terminating proxy + auto HTTPS. No self-managed nginx in MVP.
- **CORS:** `app.enableCors()` allows the Vercel frontend origin (audit #4 — without it, the browser blocks cross-origin calls).

**Why no custom reverse proxy in MVP:** Railway's managed proxy handles TLS/HTTP; adding nginx is ops overhead with no MVP benefit. Revisit if we need custom routing/WAF.

---

## 16. Backups

- **DB:** Railway managed Postgres includes automated backups + point-in-time recovery. **No custom backup scripts in MVP.**
- **Chain state:** immutable — no backup needed (it's the source of truth).
- **App config:** env vars are in Railway (versioned) + `.env.example` in git.

**Why rely on managed backups:** Railway's PITR is more reliable than cron'd `pg_dump`; building custom backup infra is out of MVP scope.

---

## 17. Rollback

**Strategy:** Railway retains prior deployments; **rollback = redeploy the previous image** (one click). DB rollbacks use forward-migrations (§7) — never `migrate reset`.

**Why image-rollback, not git-revert:** the running artifact is what matters; redeploying the last-good image is instant and doesn't require a rebuild. If a migration accompanied the bad deploy, a forward-reversal migration ships next.

**Limitation:** a migration that *dropped* a column can't be rolled back without data loss — which is why destructive migrations are forbidden (§7).

---

## 18. Deployment Strategy

**MVP: rolling (Railway default).** Railway swaps the new release in after the health check passes; old instance drains (SIGTERM → graceful shutdown, Runtime Flow Bible §16).

**Why not blue/green or canary in MVP:**
- **Blue/green** doubles cost (two instances) and needs routing config — unjustified for a single-instance demo backend.
- **Canary** needs traffic-splitting infra — overkill for the demo's traffic volume.
- Rolling + health-check gate + image-rollback covers the demo's reliability needs. These are documented as future options (§21) for when traffic/reliability demands grow.

---

## 19. Blue/Green Discussion (Future)

**When to adopt:** zero-downtime SLAs, or when a bad deploy must be instantly reversible without a rebuild window. **Cost:** 2× instances + a router that swaps `blue`/`green`. **For Kreav post-MVP:** justified only if the platform goes multi-tenant with uptime requirements.

---

## 20. Canary Discussion (Future)

**When to adopt:** risky changes (new settlement logic) where you want to route 5% traffic, observe, then ramp. **Needs:** traffic-splitting (a router or feature-flag service) + good observability to judge the canary. **For Kreav post-MVP:** a real canary would need the Observability PRD's metrics/alerts in place first.

---

## 21. Container Lifecycle & Scaling

**MVP: single instance.** The NestJS modular monolith is stateless (DB holds state; in-process caches are non-essential). If scaled horizontally:

| Concern | Horizontal-scale implication |
|---------|------------------------------|
| **Event bus** (`@nestjs/event-emitter`) | In-process → events don't cross instances. **Needs Redis pub/sub or a queue** if N>1. |
| **Throttler storage** | In-memory → per-instance limits. **Needs Redis store** for global limits. |
| **Cron/scheduled jobs** | Multiple instances → duplicate cron fires. **Needs a distributed lock or single-worker election.** |
| **Sessions** | Stateless JWT (no server sessions) → safe. |

**Future Kubernetes notes:** K8s is **not** MVP. It becomes attractive when: multi-region, autoscaling beyond a few instances, or complex routing. Migration path: containerize (already Docker), add a Redis dep for bus/throttler/cron-lock, then HPA on CPU/RPS. Until then, Railway's managed single-instance + managed Postgres is the right-size tool.

---

*Cross-reference: what runs after deploy → **Kreav Runtime Flow Bible**; how it's tested before deploy → **Kreav Testing PRD**; observing it in prod → **Kreav Observability PRD**; securing the platform key → **Kreav Security PRD**.*
