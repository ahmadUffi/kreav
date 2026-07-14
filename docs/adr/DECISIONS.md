# Keputusan Arsitektur — Kreav

Ringkasan keputusan arsitektur utama untuk hackathon MVP. Detail lengkap ada di masing-masing PRD.

---

## 1. Blockchain: Stellar

**Keputusan:** Stellar sebagai settlement layer. USDC Testnet via SAC bridge, Soroban contract untuk revenue split, Horizon + RPC untuk reads.

| Alternatif | Kenapa tidak |
|------------|-------------|
| Ethereum / EVM L2 | Gas volatility, finality lambat, USDC wrapped/bridged |
| Solana | Wallet ecosystem kurang cocok untuk "creator connects own wallet" |
| Cosmos / app-chain | Overkill — tidak butuh sovereign consensus |

**Konsekuensi:** ~5s finality, real USDC classic asset, sub-cent fees. Testnet reliability is a demo risk.

> Detail: [Backend PRD §11](../backend/Backend-PRD.md), [Stellar Standards PRD](../stellar/Stellar-Standards-PRD.md)

---

## 2. Wallet: Non-Custodial

**Keputusan:** Creator menghubungkan wallet sendiri (Freighter/LOBSTR). Backend simpan **hanya public key (G...)**. Tidak ada secret key / seed phrase di backend.

| Alternatif | Kenapa tidak |
|------------|-------------|
| Custodial | Honeypot — N creator keys di satu backend |
| Hybrid | Reintroduces honeypot; complexity without demo value |

**Konsekuensi:** Platform hanya pegang `PLATFORM_WALLET_SECRET` (sign settlement, gerakin *buyer* funds, bukan *creator* funds). Creator tanpa USDC trustline → `WAITING_WALLET`.

> Detail: [Backend PRD §4](../backend/Backend-PRD.md), [Security PRD §15](../security/Security-PRD.md)

---

## 3. Backend Topologi: Modular Monolith (NestJS)

**Keputusan:** Satu deployable unit, bounded modules, in-process event bus (`@nestjs/event-emitter`). No microservices, no Redis di MVP.

| Alternatif | Kenapa tidak |
|------------|-------------|
| Microservices | Overhead (service discovery, tracing, N deploys) untuk 3 orang |
| Serverless | Cold starts, statelessness fight event bus + cron retry |

**Konsekuensi:** Simple dev + deploy. In-process bus kehilangan event saat crash → startup recovery job (BE-012). Scaling >1 instance documented for future.

> Detail: [Backend PRD §5](../backend/Backend-PRD.md), [Runtime Flow Bible §17](../architecture/Runtime-Flow-Bible.md)

---

## 4. Smart Contract: Soroban (Rust) — Revenue Split Only

**Keputusan:** Satu Soroban contract (`settle`) via SAC bridge. Backend **mirror** (never recompute) output contract ke `Settlement` + `SettlementRecipient`.

| Alternatif | Kenapa tidak |
|------------|-------------|
| Backend do the split | Tidak trust-minimized |
| Custom Soroban token instead of USDC | Kehilangan ecosystem liquidity |
| Multiple contracts | Over-engineering untuk MVP |

**Konsekuensi:** Contract correctness is critical. Atomicity: all-or-nothing payout. `order_ref` sebagai idempotency guard.

> Detail: [Soroban Contract PRD](../stellar/Soroban-Contract-PRD.md), [Backend PRD §19](../backend/Backend-PRD.md)

---

## 5. Anchor: Mock untuk MVP

**Keputusan:** On-ramp (GCash) dan off-ramp (creator → bank) **disimulasi**. Settlement di tengah **real on testnet**.

| Alternatif | Kenapa tidak |
|------------|-------------|
| Real anchor integration | Butuh KYC, bank rails, regulated partner — out of MVP scope |
| No off-ramp | Kehilangan demo beat "creator withdraws" |

**Konsekuensi:** Pre-funded USDC float (BC-011). Mock mengikuti SEP-24 shape → drop-in replacement nanti. `Withdrawal` entity exists, bank-side flow mock.

> Detail: [Anchor PRD](../stellar/Anchor-PRD.md), [Stellar Standards PRD ED-6/ED-9](../stellar/Stellar-Standards-PRD.md)

---

## 6. Payment Provider: Simulator Component

**Keputusan:** Payment Simulator (frontend-owned) — realistic UI + `POST /api/payments/simulate` → HMAC-signed webhook → backend. Backend **provider-agnostic**.

| Alternatif | Kenapa tidak |
|------------|-------------|
| Storefront call webhook langsung | Tidak realistis, weak Q&A |
| Real PSP integration | Out of scope (regulatory, KYC) |
| No payment step | Kehilangan demo beat |

**Konsekuensi:** Storefront tidak pernah panggil `/webhooks/gcash` langsung. Backend unchanged — sudah handle HMAC + idempotency (BE-005). Narrative: **"simulated," never "fake."**

> Detail: [Backend PRD §9](../backend/Backend-PRD.md), [Demo PRD](../product/Demo-PRD.md)
