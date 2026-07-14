# Kreav Integration Workspace

A standalone TypeScript workspace for Soroban smart contract integration testing, blockchain verification, and backend reference implementation.

## Purpose

This workspace is the **canonical integration layer** between Kreav's Soroban contract and the BE-007 Settlement Service. It provides:

- **Contract verification** — confirm the deployed contract behaves correctly on Stellar Testnet
- **Reference implementation** — the exact contract-invocation patterns BE-007 will reuse
- **End-to-end testing** — payment → settlement → balance verification → event decoding
- **CI-ready automation** — all scripts executable from npm commands

> **Relationship to BE-007:** The Settlement Service (`backend/src/stellar/settlement.service.ts`) mirrors the exact flow these scripts implement. When developers work on BE-007, they refer to this workspace for the authoritative contract interface.

## Architecture

```
integration/
│
├── package.json          # npm dependencies + scripts
├── tsconfig.json         # strict TS, ES2023 target
├── .env.example          # environment template (NEVER commit .env)
├── .gitignore
│
├── types/
│   └── index.ts          # shared TypeScript interfaces & enums
│
├── helpers/
│   ├── config.ts         # env loading + typed AppConfig
│   ├── client.ts         # RPC server factory + platform keypair
│   ├── formatter.ts      # USDC decimal formatting (7 decimals)
│   ├── wallet.ts         # account checks + SAC balance queries
│   ├── logger.ts         # structured pretty-printing
│   ├── transaction.ts    # tx build → simulate → sign → submit → poll
│   ├── events.ts         # contract event parsing + display
│   ├── assertion.ts      # balance assertions + expected-split formulas
│   └── balances.ts       # pre/post settlement balance comparisons
│
├── scripts/
│   ├── 01-get-version.ts       # contract metadata
│   ├── 02-check-initialize.ts  # initialization guard
│   ├── 03-single-settlement.ts # 1 creator, 10 USDC
│   ├── 04-multi-settlement.ts  # 3 collaborators, exact amounts
│   ├── 05-idempotency.ts       # double-settle rejection
│   ├── 06-validation-errors.ts # 5 error cases
│   ├── 07-balances.ts          # all wallet balances
│   └── 08-events.ts            # event decoding from tx hash
│
├── bindings/             # 📦 Copy generated TS bindings here
│                          #   From: soroban contract bindings typescript
│
└── output/               # Generated test output (gitignored)
    └── .gitkeep
```

## Prerequisites

- **Node.js 22+** (required by `@stellar/stellar-sdk` v16)
- **npm** (the package manager for this workspace)
- **Stellar Testnet accounts** — the platform account (pre-funded with USDC) and 1–3 creator wallets
- **Deployed Kreav settlement contract** — the canonical Soroban contract (see `smartcontract/`)

## Setup

```bash
# Navigate to the integration workspace
cd KREAV-app/integration

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your deployed contract ID, keys, and wallet addresses
```

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NETWORK` | Stellar network name | `testnet` |
| `RPC_URL` | Soroban RPC endpoint | `https://soroban-testnet.stellar.org` |
| `CONTRACT_ID` | Deployed Kreav settlement contract | `C...` |
| `USDC_SAC` | USDC SAC contract (Testnet) | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| `PLATFORM_PUBLIC` | Platform account public key | `G...` |
| `PLATFORM_SECRET` | Platform account secret key | `S...` |
| `CREATOR_PUBLIC` | Creator wallet | `G...` |
| `PHOTOGRAPHER_PUBLIC` | Photographer wallet | `G...` |
| `EDITOR_PUBLIC` | Editor wallet | `G...` |

## Running

Execute scripts **in order** (01–04 are prerequisites for 05–08):

```bash
# Infrastructure checks
npm run version        # 01 — verify contract metadata
npm run initialize     # 02 — verify initialization

# Settlement flows
npm run settle:single  # 03 — single creator, 10 USDC
npm run settle:multi   # 04 — 3 collaborators, exact amounts

# Validation
npm run idempotency    # 05 — double-settle rejection
npm run validation     # 06 — 5 error cases

# Observation
npm run balances       # 07 — read all wallet balances
npm run events -- <tx> # 08 — decode events from a settlement tx
```

### What each script does

| # | Script | Contract function | Verifies | Output |
|---|--------|-------------------|----------|--------|
| 01 | `get-version` | `get_version()` | Contract ID, network, version string | Metadata summary |
| 02 | `check-initialize` | `initialize()` | AlreadyInitialized guard (fails gracefully) | PASS / AlreadyInitialized |
| 03 | `single-settlement` | `settle()` | 1 creator, 95/5 split, balance changes, events | Settlement table |
| 04 | `multi-settlement` | `settle()` | 3 collaborators, exact amounts (4.75/2.85/1.90) | Settlement table |
| 05 | `idempotency` | `settle()`, `is_settled()` | OrderAlreadySettled rejection | PASS / error code |
| 06 | `validation` | `settle()` | 5 ContractError variants | Per-test pass/fail |
| 07 | `balances` | SAC `balance()` | All wallet balances (raw + formatted) | Balance table |
| 08 | `events` | `getTransaction()` | SettlementExecuted + RecipientPaid fields | Full event dump |

## NPM Scripts

| Command | Action |
|---------|--------|
| `npm run build` | Type-check all files |
| `npm run lint` | Strict type-check |
| `npm run typecheck` | Full strict mode check |
| `npm run version` | Run 01-get-version |
| `npm run initialize` | Run 02-check-initialize |
| `npm run settle:single` | Run 03-single-settlement |
| `npm run settle:multi` | Run 04-multi-settlement |
| `npm run idempotency` | Run 05-idempotency |
| `npm run validation` | Run 06-validation-errors |
| `npm run balances` | Run 07-balances |
| `npm run events` | Run 08-events |

## Expected Output

Each script produces structured output:

```
===============================
   Settlement Successful
===============================
  Order                  ORDER-002
  ─────────────────────────────────────────────────
  Platform Fee           0.5000000 USDC
  Creator Pool           9.5000000 USDC
  ─────────────────────────────────────────────────
  Transfers
  GCREATOR...            4.7500000 USDC
  GPHOTOGR...            2.8500000 USDC
  GEDITOR...             1.9000000 USDC
  ─────────────────────────────────────────────────
  Transaction            a1b2c3d4...
```

## Contract Interface

The canonical contract exposes **4 functions**:

```rust
fn initialize(platform_wallet: Address, usdc_sac: Address) -> Result<(), ContractError>;
fn settle(order_ref: String, total_amount: i128, recipients: Vec<Recipient>) -> Result<(), ContractError>;
fn is_settled(order_ref: String) -> bool;
fn get_version() -> String;
```

Where `Recipient = { address: Address, share_bps: i128 }`.

**Key design decisions:**
- `usdc_sac` and `source` are **NOT** parameters — read from storage (set during `initialize`)
- `share_bps` is `i128`, **not** `u32`
- `order_ref` is `String`, **not** `Symbol` (UUIDs exceed Symbol's 32-char limit)
- **No `role` field** in Recipient (stored in PostgreSQL, not on-chain)

## Money Logic

The contract computes (not the backend):

```
platform_fee  = total_amount × 500 / 10000     (5.00%)
creator_pool  = total_amount − platform_fee     (95.00%)
per_recipient = creator_pool × share_bps / 10000

Last recipient absorbs integer-division rounding dust:
  last_amount = creator_pool − Σ(previous_amounts)
```

## Decimal Scaling

USDC on Stellar uses **7 decimals** (NOT 6 like EVM):

| Unit | 10 USDC representation |
|------|------------------------|
| Display | `"10.00"` |
| Base units (i128) | `100_000_000` |
| Helper | `formatUsdc(100_000_000n)` → `"10.0000000"` |

Conversion: `amount_base = amount_usd × 10^7`

## Generated TypeScript Bindings

The `bindings/` directory is where auto-generated TypeScript bindings should be copied.

To generate bindings from the contract:

```bash
# Requires the soroban CLI
soroban contract bindings typescript \
  --contract-id <CONTRACT_ID> \
  --network testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --output-dir integration/bindings
```

Once copied, binding types can be imported:

```typescript
import { KreavSettlementContract } from '../bindings/index.js';
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `Missing required env variable` | `.env` not configured | Copy `.env.example` → `.env` and fill values |
| `SimulationFailed` | Contract not deployed | Verify `CONTRACT_ID` is correct and deployed |
| `op_no_trust` | Creator lacks USDC trustline | Create trustline in Freighter/LOBSTR |
| `insufficient balance` | Platform float depleted | Top up `PLATFORM_PUBLIC` with testnet USDC |
| `Transaction NOT_FOUND` | RPC 7-day window expired | Re-settle (the tx is lost; old ones cannot be verified) |
| `Duplicate event` | Script re-ran with same ORDER | Use a fresh `orderRef` (scripts use `Date.now()` suffix) |
| `typecheck` errors | Stale `node_modules` | `npm install` |

## Architecture References

| Document | Relevance |
|----------|-----------|
| `docs/stellar/Soroban-Contract-PRD.md` | Contract specification, business rules, auth, events |
| `docs/stellar/Stellar-Standards-PRD.md` | RPC vs Horizon, USDC decimals, SAC, trustlines |
| `docs/backend/Backend-PRD.md` | Settlement sequence, failure handling, data model |
| `docs/architecture/Sequence-Diagram-Bible.md` | Settlement sequence (§10), Contract Invocation (§24), RPC Verification (§25) |
| `docs/architecture/Runtime-Flow-Bible.md` | Runtime behavior, error recovery |
| `smartcontract/src/lib.rs` | Canonical contract source (Rust) |
| `backend/src/stellar/settlement.service.ts` | BE-007 Settlement Service (NestJS) |
| `backend/src/stellar/soroban-rpc.service.ts` | BE-007 RPC integration helpers |
