# Kreav

**A programmable settlement layer for digital-product creators, powered by Stellar.**

A buyer pays for a digital product → a Soroban smart contract automatically splits the revenue (95% creator / 5% platform) → the creator receives USDC in their own non-custodial Stellar wallet → the transaction is verifiable on-chain in seconds.

> **Hackathon:** APAC Stellar Hackathon 2026 — Track 3: Payment & Consumer Applications.
> **Demo one-liner:** A buyer (Philippines) pays 10 USDC for a digital product → Soroban contract splits → **9.50 USDC to the Indonesian creator / 0.50 USDC to the platform** → creator withdraws.

---

## Why Kreav

- 🌏 **Global & cross-border by default** — a buyer anywhere pays, a creator **in any country** gets paid in **USDC**, settled on Stellar in seconds. No FX spread, no correspondent-bank delays, no per-country payout accounts. Receiving and splitting USDC is fully global; only fiat cash-out depends on the local anchor available — **Southeast Asia is our initial focus**, not a technical limit.
- 🧩 **Programmable revenue splits with collaborators** — a single sale is split **atomically on-chain** across the creator and any collaborators (each with their own share); the Soroban contract enforces the split — nobody has to trust a spreadsheet. Platform fee is a fixed 5%.
- 🔑 **Non-custodial** — money lands directly in the creator's **own Freighter wallet**. The backend never holds private keys or funds — it only orchestrates the settlement.
- 💸 **Cash out to the real world** — withdraw USDC to fiat via a **SEP-24 anchor off-ramp**, so on-chain earnings become spendable money.
- 🔗 **Creator mini-site** — a public **Linktree-style page** (`/u/username`) with bio, avatar, social links, custom links, and featured products — the creator's storefront + link-in-bio in one.
- ⚡ **One-click USDC activation** — the platform **sponsors the trustline fee + reserve** (CAP-33), so a creator can accept USDC without first owning any XLM.
- 🔍 **Verifiable on-chain** — every settlement produces a real **txHash + explorer link**; balances are read live from Horizon, not a ledger the platform controls.
- 🧾 **Instant, provider-agnostic payments** — buyers check out with an in-app demo payment now, and the backend is built to consume any verified payment event (local PSP/GCash-style) later — plus automatic **email delivery** of the purchased product.
- 📊 **Creator dashboard** — products, orders, wallet, and revenue overview in one refined app surface.

---

## Live & On-chain

| | |
|---|---|
| **App (frontend)** | https://kreav.space |
| **API (backend)** | https://api.kreav.space |
| **Settlement contract** | `CCP3KJSVEO5B7XJICHI2FK4AHXIHRWSYBA5B7DJUYY57GFCW5DGCJDCZ` — [view on explorer](https://stellar.expert/explorer/testnet/contract/CCP3KJSVEO5B7XJICHI2FK4AHXIHRWSYBA5B7DJUYY57GFCW5DGCJDCZ) |
| **Network** | Stellar Testnet |
| **Asset** | USDC (classic, via SAC) · issuer `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` |
| **Platform wallet** | `GDA2SQ2PHWIER57TDXKLBSOD3IT4GTAHK5RV2H27LJZAXDBWQ6KYJ72B` (receives 5%, signs settlements) |

---

## Repository Structure

```
kreav/
├── backend/           # NestJS + Prisma + PostgreSQL (modular monolith) — pnpm
├── frontend/          # Next.js 16 + Tailwind v4 — npm
├── smartcontract/     # Soroban revenue-split contract (Rust)
├── integration/       # Soroban contract integration tests (npm/tsx)
├── docs/              # Engineering Bible (all documentation)
│   ├── product/       # Product scope, demo script, pitch deck
│   ├── architecture/  # System architecture, runtime flows, sequence diagrams
│   ├── backend/       # Backend PRD, backlog, deployment, testing, observability
│   ├── stellar/       # Stellar standards, Soroban contract spec, anchor design
│   ├── security/      # Security PRD + security audit
│   ├── reviews/       # Architecture reviews + consistency reports
│   └── archive/       # Superseded / historical documents
├── docker-compose.yml # Production stack (backend + frontend + Caddy)
├── Caddyfile          # Reverse proxy + automatic HTTPS
├── .env.example       # Root deploy vars (domains, NEXT_PUBLIC_*, ACME email)
├── AGENTS.md          # Working agreement for AI agents & contributors
└── README.md          # This file
```

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 16 (App Router) + React 19 + Tailwind v4 — package manager: **npm** |
| Backend | NestJS 11 (modular monolith) + Prisma — package manager: **pnpm** |
| Database | PostgreSQL via Prisma ORM (managed on **Neon**) |
| Blockchain | Stellar (Soroban RPC primary; Horizon for balances/explorer) |
| Smart contract | Soroban (Rust) — revenue-split contract only |
| Asset | USDC (classic asset via the SAC bridge) |
| Wallet | Non-custodial — Freighter / LOBSTR (backend stores only public keys) |
| Auth | SEP-10 wallet authentication (sign a challenge in Freighter → session JWT) |
| Anchor / ramps | **Off-ramp:** SEP-24 interactive withdrawal via the SDF test anchor (`testanchor.stellar.org`), flagged by `ANCHOR_ENABLED`. **On-ramp:** simulated in MVP (in-app demo payment; backend is provider-agnostic). |
| Deployment | Self-hosted **VPS** · **Docker Compose** (backend + frontend + **Caddy**) · Caddy automatic HTTPS · DB on **Neon** |

---

## Setup & Run

The MVP runs end-to-end: a buyer pays (demo), USDC is split to the creator's wallet on-chain, and the product link is emailed. Steps that need the platform secret key or the Stellar CLI are run by **you** (agents never hold your secrets).

### 0. Prerequisites

| Tool | Check | Install |
|------|-------|---------|
| Rust + wasm target | `rustc --version` | https://rustup.rs then `rustup target add wasm32v1-none` |
| Stellar CLI ≥ v22 | `stellar --version` | `cargo install --locked stellar-cli` |
| Node 24 (app) / 22+ (integration) | `node -v` | https://nodejs.org |
| pnpm 11+ (backend) · npm (frontend & integration) | `pnpm -v` / `npm -v` | `npm i -g pnpm` |
| Freighter (browser) | extension installed | https://freighter.app — set **Network: Testnet** |

```bash
stellar network use testnet
```

### 1. Platform wallet (settlement signer + USDC float holder)

The platform account signs `settle` and holds the USDC float. To use a fresh one:

```bash
stellar keys generate platform --network testnet --fund --overwrite
stellar keys address platform    # → PLATFORM_WALLET_ADDRESS (G…)
stellar keys show platform       # → PLATFORM_WALLET_SECRET (S…)  ⚠️ SECRET
```

> 🔒 `PLATFORM_WALLET_SECRET` is the **only** server-side secret (documented non-custodial exception in `AGENTS.md`). Keep it in `backend/.env` (gitignored) — never logged or committed.
>
> ⚠️ **Changing the platform wallet ⇒ redeploy the contract.** `initialize` binds the platform address into the contract and is immutable; deploy a new contract (§3) and refill `SPLIT_CONTRACT_ID`.

### 2. USDC float for the platform

`settle` transfers USDC from the platform to creators, so the platform must **hold USDC** and have a **trustline**.

**Option A — issue your own test USDC (recommended):** you control the issuer, so you can mint freely.

```bash
stellar keys generate usdc-issuer --network testnet --fund
stellar keys address usdc-issuer          # note as <ISSUER_G>

stellar tx new change-trust --source-account platform --line USDC:<ISSUER_G> --network testnet

stellar tx new payment --source-account usdc-issuer --destination <PLATFORM_G> \
  --asset USDC:<ISSUER_G> --amount 10000000000 --network testnet
# amount is in stroops (7 decimals): 1,000 USDC = 1000 * 10^7
```

**Option B — canonical USDC `GBBD47…`:** trustline to `USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`, then fund via a Circle/anchor faucet.

**Get the USDC SAC address (needed for `initialize`)** — the contract (C…), not the issuer (G…):

```bash
stellar contract id asset --asset USDC:<ISSUER_G> --network testnet     # prints <USDC_SAC_C>
# if not yet on-chain: stellar contract asset deploy --asset USDC:<ISSUER_G> --source-account platform --network testnet
```

Canonical testnet USDC SAC (Option B) = `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`.

### 3. Build & deploy the settlement contract

```bash
cd smartcontract
stellar contract build     # → target/wasm32v1-none/release/kreav_settlement_contract.wasm

stellar contract deploy \
  --wasm target/wasm32v1-none/release/kreav_settlement_contract.wasm \
  --source-account platform --network testnet
# ⇒ prints CONTRACT_ID (C…)  ← this becomes SPLIT_CONTRACT_ID

stellar contract invoke --id <CONTRACT_ID> --source-account platform --network testnet -- \
  initialize --platform_wallet <PLATFORM_G> --usdc_sac <USDC_SAC_C>

stellar contract invoke --id <CONTRACT_ID> --source-account platform --network testnet -- get_version
# ⇒ "Kreav Settlement v1.0.0"
```

> ⚠️ Anyone can call `initialize` first (front-run) — low risk on testnet; deploy+initialize back-to-back. A permanent `__constructor` fix is queued in the ROADMAP.

### 4. Environment

**`backend/.env`** (gitignored):
```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://...            # Neon connection string

SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
HORIZON_URL=https://horizon-testnet.stellar.org
PLATFORM_WALLET_ADDRESS=<PLATFORM_G>
PLATFORM_WALLET_SECRET=<PLATFORM_S>       # SECRET
USDC_ISSUER=<ISSUER_G>                    # your issuer (A) or GBBD47… (B)
USDC_ASSET_CODE=USDC
SPLIT_CONTRACT_ID=<CONTRACT_ID>           # from §3
EXPLORER_URL=https://stellar.expert/explorer/testnet

DEMO_MODE=true                            # enables the in-app "pay (demo)" button
RESEND_API_KEY=                           # empty → emails are logged, not sent
RESEND_FROM=Kreav <hello@kreav.space>     # must be a verified-domain sender
ANCHOR_ENABLED=false                      # true → real SEP-24 anchor off-ramp

JWT_SECRET=                               # dev default ok; REQUIRED & random in prod
GCASH_WEBHOOK_SECRET=                     # empty locally; set to exercise the HMAC path
```

**`frontend/.env.local`**:
```
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_ANCHOR_ENABLED=false          # must match backend ANCHOR_ENABLED
```

**`integration/.env`** (copy from `integration/.env.example`): `NETWORK`, `RPC_URL`, `CONTRACT_ID`, `USDC_SAC`, `PLATFORM_PUBLIC`, `PLATFORM_SECRET`, and test creator public keys.

### 5. Verify on-chain (before touching the backend)

```bash
cd integration
npm install
npm run version         # contract metadata
npm run initialize      # AlreadyInitialized guard (expect "already initialized")
npm run settle:single   # 1 creator, 10 USDC → 9.50 received
npm run settle:multi    # 3 collaborators, exact amounts
npm run idempotency     # double-settle rejected
npm run balances        # read balances
```

`settle:single` showing the creator receiving **9.50 USDC** + a txHash ⇒ the contract is healthy. (The test creator needs a USDC trustline first — see §6.)

### 6. Creator USDC trustline

Every receiving creator **must** have a USDC trustline, or `settle` reverts atomically (`op_no_trust`) for all collaborators.

- **Sponsored by the app (done):** the dashboard shows an **"Activate USDC"** banner when the trustline is missing — one click, sign in Freighter; **network fee + reserve are covered by the platform** (`POST /wallets/trustline/prepare` + `/submit`). This is the demo path.
- **Manual fallback:** in the creator's Freighter (Testnet) → Manage Assets → add `USDC:<ISSUER_G>`.

### 7. Run backend + frontend

```bash
# terminal 1
cd backend && pnpm install && pnpm prisma migrate deploy && pnpm start:dev
# terminal 2
cd frontend && npm install && npm run dev
```

For production the whole stack runs on a VPS via `docker compose up -d --build` behind Caddy — see [Deployment PRD](./docs/backend/Deployment-PRD.md).

---

## Demo flow (what judges try)

1. **Creator:** register → connect Freighter → dashboard wallet → **Activate USDC** (sponsored trustline) → create a product (set `fileUrl` + collaborators: wallet + %).
2. **Buyer/judge:** open `/store` → pick a product → **enter email** → **Buy now** → the **"pay (demo)"** panel → **Pay** (uses `DEMO_MODE`).
3. **Automatic:** internal webhook → `settle` on-chain → USDC split (95% creator / 5% platform) to the wallet → **product link emailed** to the buyer (or logged when `RESEND_API_KEY` is empty).
4. **Proof:** creator balance rises by 9.50 USDC + a txHash → stellar.expert; a `NotificationLog` row is recorded.

---

## Troubleshooting

| Symptom | Cause | Fix |
|--------|-------|-----|
| `SimulationFailed` on invoke | Contract not deployed / wrong ID | Check `SPLIT_CONTRACT_ID` |
| `NotInitialized` | `initialize` not called | §3 |
| `op_no_trust` | Creator has no USDC trustline | §6 (Activate USDC) |
| `SETTLEMENT_FAILED` after changing wallet | Old contract bound to old wallet | Deploy a new contract with the new wallet, refill `SPLIT_CONTRACT_ID` (§3) |
| `insufficient balance` | Platform USDC float depleted | Repeat §2 (mint/send USDC to the platform) |
| "Pay (demo)" → 403 | `DEMO_MODE` off | Set `DEMO_MODE=true` in `backend/.env`, restart |
| Email not in inbox | `RESEND_API_KEY` empty / unverified sender | Set the key + verified-domain `RESEND_FROM`; or read the link in server logs |
| Anchor cash-out "amount exceeds … maximum limit" | SDF test anchor caps USDC withdrawals at 1–10 | Withdraw within 1–10 per transaction |
| `Transaction NOT_FOUND` | RPC 7-day window elapsed | Re-settle with a new orderRef |

---

## Roadmap

Kreav is built to last beyond the hackathon — a phased path from a secure on-chain foundation to real fiat rails, product depth, and mainnet readiness.

| Phase | Focus | Status |
|-------|-------|--------|
| 0–1.5 | Core settlement · SEP-10 auth · sponsored onboarding | ✅ shipped |
| 2 | Real money rails (on/off-ramp) | 🚧 SEP-24 off-ramp live on testnet · on-ramp next |
| 3 | Product delivery & engagement | 🚧 email live · secure file delivery next |
| 4 | Trust, compliance & scale | 🔜 pre-mainnet |

**→ Full roadmap & sustainability model: [ROADMAP.md](./ROADMAP.md)**

---

## Documentation Map

New to Kreav? Read the docs in this order:

| # | Document | Purpose |
|---|----------|---------|
| 1 | [Product Scope](./docs/product/Product-Scope.md) | MVP scope, features, demo flow, non-goals |
| 2 | [System Architecture](./docs/architecture/System-Architecture.md) | System architecture (mermaid), money & event flows |
| 3 | [Backend PRD](./docs/backend/Backend-PRD.md) | NestJS module design, DB schema, API spec — the single source of truth |
| 4 | [Runtime Flow Bible](./docs/architecture/Runtime-Flow-Bible.md) | How the system behaves while running — every WHAT paired with a WHY |
| 5 | [Sequence Diagram Bible](./docs/architecture/Sequence-Diagram-Bible.md) | Every important sequence (30 diagrams) with explanations |
| 6 | [Stellar Standards PRD](./docs/stellar/Stellar-Standards-PRD.md) | Every Stellar standard, protocol, SDK, and architectural decision |
| 7 | [Soroban Contract PRD](./docs/stellar/Soroban-Contract-PRD.md) | The Revenue Split contract specification |
| 8 | [Anchor PRD](./docs/stellar/Anchor-PRD.md) | Fiat on-ramp/off-ramp architecture (mock in MVP) |
| 9 | [Deployment PRD](./docs/backend/Deployment-PRD.md) | Production deployment, Docker, CI/CD, secrets, rollback |
| 10 | [Security PRD](./docs/security/Security-PRD.md) | Threat model, trust boundaries, controls, OWASP mapping |

<details>
<summary><strong>Full documentation index</strong></summary>

**root/** — [ROADMAP](./ROADMAP.md) — phased product roadmap & sustainability model
**product/** — [Product-Scope](./docs/product/Product-Scope.md) · [Demo-PRD](./docs/product/Demo-PRD.md) · [Hackathon-Brief](./docs/product/Hackathon-Brief.md) · [Pitch-Deck](./docs/product/Pitch-Deck.md)
**architecture/** — [System-Architecture](./docs/architecture/System-Architecture.md) · [Runtime-Flow-Bible](./docs/architecture/Runtime-Flow-Bible.md) · [Sequence-Diagram-Bible](./docs/architecture/Sequence-Diagram-Bible.md)
**backend/** — [Backend-PRD](./docs/backend/Backend-PRD.md) · [Implementation-Backlog](./docs/backend/Implementation-Backlog.md) · [Deployment-PRD](./docs/backend/Deployment-PRD.md) · [Testing-PRD](./docs/backend/Testing-PRD.md) · [Observability-PRD](./docs/backend/Observability-PRD.md)
**stellar/** — [Stellar-Standards-PRD](./docs/stellar/Stellar-Standards-PRD.md) · [Soroban-Contract-PRD](./docs/stellar/Soroban-Contract-PRD.md) · [Anchor-PRD](./docs/stellar/Anchor-PRD.md)
**security/** — [Security-PRD](./docs/security/Security-PRD.md) · [Security-Audit](./docs/security/Security-Audit.md)
**reviews/** — [Final-Architecture-Review](./docs/reviews/Final-Architecture-Review.md) · [Final-Consistency-Report](./docs/reviews/Final-Consistency-Report.md) · [Architecture-Consistency-Check](./docs/reviews/Architecture-Consistency-Check.md) · [Engineering-Consistency-Review](./docs/reviews/Engineering-Consistency-Review.md)
</details>

---

## Working with this repo

Contributors and AI agents: read [AGENTS.md](./AGENTS.md) first — it defines the branching model, commit conventions, TDD workflow, and the source-of-truth hierarchy.

**Source of truth:** the [Backend PRD](./docs/backend/Backend-PRD.md) v3 + v3.1 addendum governs the application layer and data model; the [Stellar Standards PRD](./docs/stellar/Stellar-Standards-PRD.md) governs Stellar-specific mechanics. On conflict: official Stellar docs → Architecture Consistency Check → Backend PRD.
