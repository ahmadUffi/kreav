# Glossary

> **Status:** Authoritative definitions for every Kreav business + technical term. When a term is used in any doc, it means exactly what's defined here.
> **Cross-refs:** each term links to where it's defined in detail.

---

## Business / domain terms

### Settlement
The on-chain act of distributing a purchase's USDC to recipients per the split (95% creator pool / 5% platform), executed atomically by the Soroban split contract. One settlement = one on-chain transaction = one `txHash`. → [Soroban Contract PRD](../stellar/Soroban-Contract-PRD.md), [ADR-006](../adr/ADR-006-Why-SettlementRecipient.md)

### SettlementRecipient
A single recipient's row in a settlement's accounting breakdown (address, type, role, percentage, amount). One `Settlement` has N `SettlementRecipient` children — the "1 + N" model. → [ADR-006](../adr/ADR-006-Why-SettlementRecipient.md), [ERD](../database/ERD.md)

### Withdrawal
A creator's conversion of their wallet USDC into local currency via an anchor. **Mocked** in MVP (no real USDC leaves the wallet). Recorded as a `Withdrawal` entity. → [Anchor PRD](../stellar/Anchor-PRD.md), [ADR-008](../adr/ADR-008-Why-Mock-Anchor-for-MVP.md)

### Platform Wallet
The platform's Stellar account (`PLATFORM_WALLET_ADDRESS`). It **signs settlements** (`PLATFORM_WALLET_SECRET`, the sole server-side secret) and **holds the pre-funded USDC float** the contract draws from. → [Security PRD §16](../security/Security-PRD.md), ED-2/ED-9/ED-10

### Creator Wallet
A creator's own non-custodial Stellar account (Freighter/LOBSTR). Kreav stores **only the public key**. Must have a USDC trustline to receive settlements. → [ADR-002](../adr/ADR-002-Why-Non-Custodial.md)

### Platform Fee
The 5% share taken off the top of every purchase, sent to the platform wallet. Stored in the contract as 500 bps. → [Soroban Contract PRD §3](../stellar/Soroban-Contract-PRD.md)

### Revenue Split
The contract-enforced division: 5% platform fee first, then the 95% creator pool distributed across `ProductCollaborator` shares (summing to 100% of the pool). → [Backend PRD §19](../backend/Backend-PRD.md)

### Pre-funded USDC Float
The MVP mechanism: the platform account is pre-funded with testnet USDC by the team (BC-011) because the buyer's GCash payment is mocked and mints no USDC. Each settlement draws it down (~−10 USDC/sale). → [ADR C1](../reviews/Final-Architecture-Review.md), ED-9, [ADR-008](../adr/ADR-008-Why-Mock-Anchor-for-MVP.md)

### Treasury
**Not a Kreav MVP concept.** A historical diagram artifact (removed). `RecipientType.TREASURY` is a *reserved* future enum value, not used in MVP. Do not reintroduce a Treasury wallet. → [Final Architecture Review §Inconsistencies](../reviews/Final-Architecture-Review.md)

---

## State / lifecycle terms

### Application State
Data living in PostgreSQL (users, products, orders, settlement *records*, withdrawals). → [ADR-007](../adr/ADR-007-Why-PostgreSQL-vs-Blockchain.md)

### Settlement State
Data living on Stellar (wallet balances, trustlines, the split transaction). Balance truth = live Horizon read. → [ADR-007](../adr/ADR-007-Why-PostgreSQL-vs-Blockchain.md)

### WAITING_WALLET
An `OrderStatus` deferral state: payment was received but the creator has no connected wallet / no USDC trustline. Settlement is deferred (not failed) until the creator connects + trustlines. → [Runtime Flow Bible §11](../architecture/Runtime-Flow-Bible.md#11-order-state-machine), [Error-Codes](../api/Error-Codes.md)

### Order State Machine
The 13-state `OrderStatus` lifecycle (`CREATED → ... → WITHDRAW_COMPLETED` + 5 failure/deferral states). Only legal transitions pass. → [Runtime Flow Bible §11](../architecture/Runtime-Flow-Bible.md#11-order-state-machine)

### `order_ref`
The Soroban contract's idempotency parameter. **`order_ref` = `Order.id` (the UUID)** (ADR H2). A duplicate `settle` for the same `order_ref` is rejected by the contract. → [Soroban Contract PRD §0/§3](../stellar/Soroban-Contract-PRD.md)

### `paymentRef`
The GCash Payment Transaction ID, stored on `Order.paymentRef` (UNIQUE). Idempotency key on the *webhook* side (one payment → one order). Distinct from `order_ref`. → [Backend PRD §20](../backend/Backend-PRD.md), audit #5

### Notification
An async email (Resend) tied to a business event. Durable via `NotificationLog`; retries 3× then dead-letters. A notification failure never rolls back a business transaction. → [Backend PRD §18](../backend/Backend-PRD.md)

---

## Stellar terms

### Anchor
A regulated fiat↔Stellar bridge. Kreav uses a **mock** SEP-24-shaped anchor in MVP; real anchors (SEP-6/SEP-24 + SEP-12 KYC) are future. → [Anchor PRD](../stellar/Anchor-PRD.md)

### SEP (Stellar Ecosystem Proposal)
A Stellar standard. Kreav's relevant SEPs: **SEP-41** (token interface, via SAC — foundational), **SEP-24** (hosted anchor flow — mocked), **SEP-10** (wallet auth — post-MVP), **SEP-6/SEP-12/SEP-31/SEP-38** (future). → [Stellar Standards PRD §10](../stellar/Stellar-Standards-PRD.md)

### CAP (Core Advancement Proposal)
A Stellar protocol-level proposal. Relevant: CAP-0046 (Soroban), CAP-0058 (constructors). Kreav depends on these via Soroban; doesn't author them. → [Stellar Standards PRD](../stellar/Stellar-Standards-PRD.md)

### RPC (Soroban RPC)
The JSON-RPC API, **primary** for Soroban contract invocation + settlement verification (`simulateTransaction`/`sendTransaction`/`getTransaction`). ~7-day history window. → [ADR-005](../adr/ADR-005-Why-RPC-Primary.md), [Stellar Standards §7](../stellar/Stellar-Standards-PRD.md)

### Horizon
The legacy REST API, **secondary**: rich account balance reads (`loadAccount`) + explorer detail. Not for Soroban submission. → [ADR-005](../adr/ADR-005-Why-RPC-Primary.md), [Stellar Standards §6](../stellar/Stellar-Standards-PRD.md)

### Soroban
Stellar's smart-contract platform (Rust → WASM). Kreav ships **one** Soroban contract (the Revenue Split). → [ADR-004](../adr/ADR-004-Why-Soroban.md)

### SAC (Stellar Asset Contract)
The bridge that exposes a classic asset (USDC) as a Soroban token via the SEP-41 interface. `asset.contractId(Networks.TESTNET)` → the USDC SAC `C...` address. → [Stellar Standards §3](../stellar/Stellar-Standards-PRD.md)

### Trustline
An account's explicit relationship with a credit asset. Required to receive USDC; missing → `op_no_trust`. Created by the account owner (non-custodial). → [Stellar Standards §5](../stellar/Stellar-Standards-PRD.md)

### USDC
Circle's USD stablecoin, a classic Stellar asset. **7 decimals** on-chain. Testnet issuer `G...` = `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`; SAC `C...` = `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`. → [Stellar Standards §3](../stellar/Stellar-Standards-PRD.md), ED-7

### Non-Custodial
Wallet strategy: the backend stores only public keys; creators hold their own keys. → [ADR-002](../adr/ADR-002-Why-Non-Custodial.md)

---

## Kreav two-address caveat (USDC)

USDC has **two addresses** — do not confuse:
- **Classic issuer (`G...`)** — used when adding a trustline (`new Asset("USDC", G...)`).
- **SAC contract (`C...`)** — what the split contract invokes `transfer` on.

→ [Stellar Standards §3](../stellar/Stellar-Standards-PRD.md)

---

*Cross-reference: full architecture → [.ai/architecture.md](../../.ai/architecture.md); ADRs → [docs/adr/](../adr/).*
