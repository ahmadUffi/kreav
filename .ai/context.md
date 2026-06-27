# .ai/context.md — Kreav for AI Coding Agents

> **Purpose:** The fast-load orientation an AI agent reads first. Concise. Not a PRD copy — pointers + invariants. Always read [`AGENTS.md`](../AGENTS.md) for the binding workflow.
> **Keep this ~300–500 lines.** If it grows, split it.

---

## What Kreav is (one paragraph)
A programmable settlement layer for digital-product creators on Stellar. A buyer pays → a Soroban smart contract splits revenue **95% creator / 5% platform** → the creator receives USDC in their own non-custodial wallet → verifiable on-chain. **Demo:** Filipino buyer pays 10 USDC for "AI Interview Playbook" → 9.50 USDC to Indonesian creator / 0.50 to platform → simulated withdrawal.

> **Payment is simulated; settlement is real.** The buyer pays via a **Payment Simulator** (simulated PSP — ADR-009, FE-007), which sends an HMAC-signed payment event to the backend. The backend is provider-agnostic (it verifies the signature, not trusts a sender). The Soroban settlement — real USDC, real txHash — is the core. Narrative: *"payment provider is replaceable; Stellar is core infrastructure."*

## Agent scope
**BACKEND ONLY** (NestJS + Prisma + PostgreSQL). Not frontend. Not writing the Soroban contract (the BC team owns the Rust contract; the backend only *invokes* it via RPC). Calling Horizon/Soroban from NestJS **is** in scope.

## Authority hierarchy (on any conflict)
1. Official Stellar docs (skills.stellar.org) — Stellar mechanics
2. [`docs/reviews/Architecture-Consistency-Check.md`](../docs/reviews/Architecture-Consistency-Check.md)
3. [`docs/reviews/Final-Architecture-Review.md`](../docs/reviews/Final-Architecture-Review.md)
4. [`docs/backend/Backend-PRD.md`](../docs/backend/Backend-PRD.md) v3 + v3.1 (application layer + data model source of truth)
5. Everything else

## Repository map
```
KREAV-app/
├── backend/            ← YOU WORK HERE (NestJS). src/<feature>/ + prisma/ + test/
├── frontend/           ← NOT YOUR SCOPE (Next.js)
├── smartcontract/      ← NOT YOUR SCOPE (Rust/Soroban) — note: was "smartcontarct", renamed
├── docs/               ← Engineering Bible (read before building)
│   ├── adr/            ← 8 immutable architecture decisions
│   ├── api/            ← API standards, error codes, versioning
│   ├── database/       ← DB bible, ERD, migration guide
│   ├── engineering/    ← coding standards, branching, code review
│   ├── glossary/       ← term definitions
│   ├── demo/           ← playbook, checklist, failure recovery
│   ├── stellar/        ← Stellar Standards, Soroban Contract, Anchor PRDs
│   ├── security/       ← Security PRD + audit
│   └── reviews/        ← architecture reviews + consistency reports
├── .ai/                ← THIS (agent context/rules/prompts)
├── AGENTS.md           ← binding workflow (read first)
├── README.md           ← entry point + doc map
└── compose.yml         ← local Postgres
```

## Tech stack (one line each)
- **Backend:** NestJS 11 (modular monolith) + Prisma 6 + PostgreSQL 16 + TypeScript strict
- **Stellar:** `@stellar/stellar-sdk` — **RPC primary** (Soroban invoke/verify), Horizon secondary (balance/explorer)
- **Asset:** USDC classic via SAC bridge (7 decimals on-chain; DB stores Decimal(18,2))
- **Wallet:** non-custodial — Freighter/LOBSTR, backend stores **only public keys**
- **Notify:** Resend (BE-013), NotificationLog for durable retry
- **Deploy:** Railway (backend+DB), Vercel (frontend), Stellar Testnet (chain)

## The 8 immutable ADRs (read before touching architecture)
1. [Why Stellar](../docs/adr/ADR-001-Why-Stellar.md) — chain choice
2. [Why Non-Custodial](../docs/adr/ADR-002-Why-Non-Custodial.md) — backend stores only public keys
3. [Why Modular Monolith](../docs/adr/ADR-003-Why-Modular-Monolith.md) — one deploy, in-process bus
4. [Why Soroban](../docs/adr/ADR-004-Why-Soroban.md) — one split contract, USDC via SAC
5. [Why RPC Primary](../docs/adr/ADR-005-Why-RPC-Primary.md) — RPC for Soroban, Horizon for reads
6. [Why SettlementRecipient](../docs/adr/ADR-006-Why-SettlementRecipient.md) — 1 + N accounting model
7. [Why PostgreSQL vs Blockchain](../docs/adr/ADR-007-Why-PostgreSQL-vs-Blockchain.md) — state separation
8. [Why Mock Anchor for MVP](../docs/adr/ADR-008-Why-Mock-Anchor-for-MVP.md) — real settle, mock fiat
9. [Why Simulated Payment Provider for MVP](../docs/adr/ADR-009-Why-Simulated-Payment-Provider.md) — Payment Simulator (simulated PSP); provider-agnostic backend

## Critical invariants (NEVER violate)
- **Money is `Decimal`/string, never `number`/`float`.** (audit #10, [DB Bible §8](../docs/database/Database-Bible.md))
- **Non-custodial: never store/see creator secret keys.** The only secret the backend holds is `PLATFORM_WALLET_SECRET`. (ADR-002)
- **The contract does the split; the backend MIRRORS its output** into Settlement + SettlementRecipient. Never recompute. (ADR-006, [Soroban Contract PRD §1](../docs/stellar/Soroban-Contract-PRD.md))
- **Settlement retries VERIFY, never re-invoke** a successful settle. Double-settle = double-spend. (order_ref idempotency guard)
- **USDC = 7 decimals on-chain.** Scale DB Decimal(18,2) ↔ base units (`×10^7`). (ED-7)
- **Order transitions go through the state machine** (13 states). Illegal → `INVALID_STATE_TRANSITION`. ([Runtime Flow §11](../docs/architecture/Runtime-Flow-Bible.md#11-order-state-machine))
- **Idempotency:** `paymentRef` (webhook) + `order_ref` = `Order.id` (contract). One payment → one order → one settlement.
- **Balance truth = live Horizon read.** Never cache a balance as authoritative.
- **Webhook HMAC verified (timing-safe) before trusting the body.** (audit #11)
- **No secrets in code/logs.** `PLATFORM_WALLET_SECRET`, `GCASH_WEBHOOK_SECRET` never logged.

## Current implementation state
- **Done (merged to `develop`):** BE-001..BE-006 (infra, schema, products, checkout, event bus). 7 PRs, 96 tests green.
- **Next:** **BE-007 Settlement Service** (consume `payment.received`, invoke `settle`, verify via RPC, record 1+N). The `stellar/` module is currently a stub.
- **Schema:** 9 models, 9 enums; `SettlementRecipient.createdAt` present (H3); `Order.id` doc-commented as `order_ref` (H2). Run `prisma migrate dev --name settlement_recipient_created_at` in the BE-007 branch.

## Workflow (binding — see AGENTS.md)
- Branch `be/<slug>` off `develop` → PR to `develop` → **NEVER auto-merge** (wait for user review).
- Conventional Commits: `<type>(<scope>): <desc> (BE-XXX)`.
- Pragmatic TDD: test behavior with/before impl; never ship a `feat` without its test.
- DoD: lint + build + test green + acceptance criteria + no secrets + money as Decimal.
- CI gate: no green CI = no merge.

## Money / Stellar quick rules
- Accept money as decimal string (`"10.00"`); store `new Prisma.Decimal(str)`; the global `DecimalToStringInterceptor` returns it as string.
- Contract invocation: `getAccount → build → simulateTransaction → assembleTransaction → sign(platform key) → sendTransaction → poll getTransaction`.
- Trustline check before settle (else `op_no_trust`).
- Pre-funded float (C1): platform account pre-funded by team (BC-011); depletes ~−10 USDC/sale.

## Docs reading order (when unsure)
[Product Scope](../docs/product/Product-Scope.md) → [System Architecture](../docs/architecture/System-Architecture.md) → [Backend PRD](../docs/backend/Backend-PRD.md) → [Runtime Flow Bible](../docs/architecture/Runtime-Flow-Bible.md) → [Sequence Diagram Bible](../docs/architecture/Sequence-Diagram-Bible.md) → [Stellar Standards PRD](../docs/stellar/Stellar-Standards-PRD.md) → [Soroban Contract PRD](../docs/stellar/Soroban-Contract-PRD.md) → [Anchor PRD](../docs/stellar/Anchor-PRD.md) → [Deployment PRD](../docs/backend/Deployment-PRD.md) → [Security PRD](../docs/security/Security-PRD.md).

## Quick links
- [Glossary](../docs/glossary/Glossary.md) — every term defined
- [Error-Codes](../docs/api/Error-Codes.md) — stable error catalog
- [Code Review Checklist](../docs/engineering/Code-Review-Checklist.md) — before every PR
- [Demo Checklist](../docs/demo/Demo-Checklist.md) — pre-stage go/no-go
- [Security Audit](../docs/security/Security-Audit.md) — 22 findings, 4 fixed, rest folded

## Known open items (don't re-litigate; track via issues)
- BE-007 (settlement) is the next build; `stellar/` is a stub.
- BE-012 builds the `DomainException`/`FinancialException` hierarchy (the error codes in `docs/api/Error-Codes.md` are the contract it emits).
- `OrderStatus.WITHDRAW_FAILED` + `CANCELLED` have no documented trigger path in §20 (governance flag — BE-012 to wire or mark reserved).
- Owner (ahmadUffi) action: rename SonarCloud project key `ahmadUffi_tipschain` → `ahmadUffi_kreav`.

---

*See also: [.ai/rules.md](./rules.md) (what an agent must never do) · [.ai/architecture.md](./architecture.md) (architecture summary).*
