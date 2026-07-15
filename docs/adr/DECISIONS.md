# Architectural Decisions — Kreav

Summary of core architectural decisions for the hackathon MVP. Full details are located in the respective PRDs.

---

## 1. Blockchain: Stellar

**Decision:** Stellar as the settlement layer. USDC Testnet via the SAC bridge, a Soroban smart contract for revenue split, and Horizon + RPC for reads.

| Alternative | Why not |
|---|---|
| Ethereum / EVM L2 | Gas volatility, slow finality, wrapped/bridged USDC |
| Solana | Wallet ecosystem less suited for "creator connects own wallet" model |
| Cosmos / app-chain | Overkill — sovereign consensus is not needed |

**Consequences:** ~5s finality, real USDC classic asset, sub-cent fees. Testnet reliability is an operational demo risk.

> Details: [Backend PRD §11](../backend/Backend-PRD.md), [Stellar Standards PRD](../stellar/Stellar-Standards-PRD.md)

---

## 2. Wallet: Non-Custodial

**Decision:** Creators connect their own wallet (Freighter/Lobstr). The backend stores **only the public key (G...)**. No private keys or seed phrases exist in the backend.

| Alternative | Why not |
|---|---|
| Custodial | Honeypot — N creator keys stored in a single backend |
| Hybrid | Reintroduces honeypot risk; adds complexity without demo value |

**Consequences:** The platform only holds `PLATFORM_WALLET_SECRET` (used to sign settlements and move *buyer* funds, never *creator* funds). A creator without a USDC trustline enters `WAITING_WALLET`.

> Details: [Backend PRD §4](../backend/Backend-PRD.md), [Security PRD §15](../security/Security-PRD.md)

---

## 3. Backend Topology: Modular Monolith (NestJS)

**Decision:** A single deployable unit with bounded modules and an in-process event bus (`@nestjs/event-emitter`). No microservices or Redis in the MVP.

| Alternative | Why not |
|---|---|
| Microservices | Overhead (service discovery, tracing, N deploys) for a 3-person team |
| Serverless | Cold starts and statelessness conflict with the event bus + cron retry workers |

**Consequences:** Simple development and deployment. The in-process bus loses in-flight events on crash → mitigated by the startup recovery job (BE-012). Scaling >1 instance is documented for the future.

> Details: [Backend PRD §5](../backend/Backend-PRD.md), [Runtime Flow Bible §17](../architecture/Runtime-Flow-Bible.md)

---

## 4. Smart Contract: Soroban (Rust) — Revenue Split Only

**Decision:** A single Soroban contract (`settle`) via the SAC bridge. The backend **mirrors** (and never recomputes) the contract output into `Settlement` and `SettlementRecipient` records.

| Alternative | Why not |
|---|---|
| Backend executes the split | Not trust-minimized |
| Custom Soroban token instead of USDC | Loses ecosystem liquidity |
| Multiple contracts | Over-engineering for the MVP |

**Consequences:** Contract correctness is critical. Atomicity ensures all-or-nothing payouts. `order_ref` serves as the on-chain idempotency guard.

> Details: [Soroban Contract PRD](../stellar/Soroban-Contract-PRD.md), [Backend PRD §19](../backend/Backend-PRD.md)

---

## 5. Anchor: Mocked for MVP

**Decision:** On-ramp (GCash) and off-ramp (creator → bank) flows are **simulated**. The settlement in the middle is **real on Testnet**.

| Alternative | Why not |
|---|---|
| Real anchor integration | Requires KYC, bank rails, and regulated partners — out of MVP scope |
| No off-ramp | Loses the "creator withdraws" demo narrative beat |

**Consequences:** Requires a pre-funded USDC float (BC-011). The mock implements the SEP-24 shape → serving as a drop-in replacement later. The `Withdrawal` entity exists while the bank-side payout is mocked.

> Details: [Anchor PRD](../stellar/Anchor-PRD.md), [Stellar Standards PRD ED-6/ED-9](../stellar/Stellar-Standards-PRD.md)

---

## 6. Payment Provider: Simulator Component

**Decision:** A Payment Simulator (frontend-owned) — realistic UI + `POST /api/payments/simulate` → HMAC-signed webhook → backend. The backend remains **provider-agnostic**.

| Alternative | Why not |
|---|---|
| Storefront calling webhook directly | Unrealistic, weak during Q&A |
| Real PSP integration | Out of scope (regulatory compliance, KYC) |
| No payment step | Loses a critical demo beat |

**Consequences:** The storefront never calls `/webhooks/gcash` directly. The backend remains unchanged — already handling HMAC + idempotency (BE-005). Narrative phrasing: **"simulated," never "fake."**

> Details: [Backend PRD §9](../backend/Backend-PRD.md), [Demo PRD](../product/Demo-PRD.md)

