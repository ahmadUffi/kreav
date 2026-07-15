# Kreav Backend PRD v3 (Final)

## APAC Stellar Hackathon 2026

Version: 3.0

Status: Final

Owner: Backend Team

Architecture Style: Modular Monolith

Wallet Strategy: Non-Custodial

Settlement Layer: Stellar

Programmable Logic: Soroban

> **Companion documents (Stellar-specific design).** This PRD is the source of truth for the NestJS application layer + data model. For the chain/anchor/contract mechanics it relies on, see:
> - [`docs/stellar/Stellar-Standards-PRD.md`](../stellar/Stellar-Standards-PRD.md) — every Stellar standard, protocol, SDK, and architectural decision
> - [`docs/stellar/Anchor-PRD.md`](../stellar/Anchor-PRD.md) — fiat on-ramp/off-ramp architecture
> - [`docs/stellar/Soroban-Contract-PRD.md`](../stellar/Soroban-Contract-PRD.md) — the Revenue Split contract specification
> - Internal consistency: cross-document consistency was verified during final revision.

---

# 1. Purpose

Kreav Backend is a settlement orchestration layer connecting:

Buyer Payment

↓

Order Processing

↓

Soroban Revenue Split

↓

Creator Wallet Settlement

↓

Transaction Verification

The backend is responsible for:

* Products
* Orders
* Wallet Mapping
* Settlement Records
* Stellar Integrations

The backend does not store funds.

The backend does not hold private keys.

The backend does not manage wallet custody.

---

# 2. Product Context

Kreav enables digital creators to receive cross-border payments using Stellar.

Example:

Creator:
Indonesia

Buyer:
Philippines

Product:
AI Interview Playbook

Price:
10 USD

Flow:

Buyer purchases product

↓

Payment Success

↓

Soroban Revenue Split

↓

95% Creator

↓

5% Platform

↓

Settlement recorded on-chain

↓

Creator views balance

---

# 3. Core Business Flows

## Purchase Flow

Buyer opens storefront.

↓

Buyer initiates checkout.

↓

Order created.

↓

Mock payment succeeds.

↓

Settlement Service invoked.

↓

Soroban Contract executed.

↓

Revenue split occurs.

↓

Transaction hash received.

↓

Order transitions to SETTLED.

↓

Creator dashboard updated.

---

## Withdrawal Flow

Creator receives USDC.

↓

Creator initiates withdrawal.

↓

Redirect to Anchor Flow (mock).

↓

Withdrawal status displayed.

---

# 4. Architecture Principles

## Principle 1

PostgreSQL stores application state.

Example:

* User
* Product
* Order
* Transaction Record

---

## Principle 2

Stellar stores settlement state.

Example:

* Wallet Balance
* Trustline
* Revenue Split
* Settlement Transaction

---

## Principle 3

Creator owns the wallet.

The backend stores only:

* Public Key
* Wallet Provider

The backend does not store:

* Secret Key
* Seed Phrase
* Private Key

> **Resolution note (see Stellar Standards PRD §0).** This non-custodial stance resolves a contradiction with `docs/product/Product-Scope.md`, whose "Sponsored Custodial Wallet" wording is superseded. **Non-Custodial is the decided state.** The Product Scope document should be updated to match (see Architecture Consistency Check §C item 4).

---

## Principle 4

Blockchain is used strictly for settlement.

Application data remains in PostgreSQL.

---

# 5. High-Level Backend Architecture

```text
Frontend

↓

REST API

↓

NestJS Backend

├── Auth Module
├── User Module
├── Product Module
├── Order Module
├── Wallet Module
└── Stellar Module

↓

PostgreSQL

↓

Stellar Network

├── Horizon
├── Soroban
└── Wallet Ecosystem
```

---

# 6. Backend Modules

## Auth Module

Responsibilities:

* Login
* Register
* Session Management

Future Scope:

* Wallet Authentication
* SEP-10

---

## User Module

Responsibilities:

* Creator Profile
* User Information

---

## Product Module

Responsibilities:

* Create Product
* Product Details
* Product Listing

Endpoints:

GET /products

GET /products/:id

POST /products

---

## Order Module

Responsibilities:

* Create Order
* Manage Status
* Store Settlement References

Endpoints:

POST /checkout

POST /webhooks/payment

---

## Wallet Module

Responsibilities:

* Connect Wallet
* Query Balance
* Query Transactions

Endpoints:

POST /wallet/connect

GET /wallet

GET /wallet/balance

GET /wallet/transactions

---

## Stellar Module

Responsibilities:

* Soroban Integration
* Horizon Integration
* Settlement Verification

Internal Service Only

No Public Endpoint

---

# 7. Folder Structure

```text
src/

├── auth/
│
├── users/
│
├── products/
│
├── orders/
│
├── wallets/
│
├── stellar/
│   ├── stellar.service.ts
│   ├── horizon.service.ts
│   ├── soroban.service.ts
│   └── dto/
│
├── prisma/
│
├── common/
│
└── app.module.ts
```

---

# 8. Database Design

## User

Fields:

* id
* email
* name
* role
* created_at

---

## Product

Fields:

* id
* creator_id
* title
* description
* price_usd
* created_at

---

## Order

Fields:

* id
* product_id
* buyer_email
* amount_usd
* status
* tx_hash
* created_at

Status:

* PENDING
* PAID
* SETTLING
* SETTLED
* FAILED

---

## Wallet

Fields:

* id
* creator_id
* wallet_address
* provider
* connected_at

Providers:

* Freighter
* Lobstr

---

## Transaction

Fields:

* id
* creator_id
* order_id
* tx_hash
* amount
* type
* status
* created_at

Types:

* SETTLEMENT
* WITHDRAWAL

Statuses:

* PENDING
* COMPLETED
* FAILED

---

# 9. API Specification

## Connect Wallet

POST /wallet/connect

Request

```json
{
  "walletAddress": "GXXXXXXXXXXXXXXXXXXXX"
}
```

Response

```json
{
  "success": true
}
```

---

## Product APIs

GET /products

GET /products/:id

POST /products

---

## Checkout

POST /checkout

Request

```json
{
  "productId": "123"
}
```

Response

```json
{
  "orderId": "abc123"
}
```

---

## Payment Webhook

POST /webhooks/payment

Purpose:

Simulate payment confirmation.

---

## Wallet Balance

GET /wallet/balance

Response

```json
{
  "balanceUsdc": "9.50"
}
```

Source:

Horizon API

---

## Wallet Transactions

GET /wallet/transactions

Response

```json
[
  {
    "txHash": "...",
    "amount": "9.50",
    "type": "SETTLEMENT"
  }
]
```

---

## Withdraw

POST /wallet/withdraw

Request

```json
{
  "amount": "5"
}
```

Response

```json
{
  "status": "processing"
}
```

---

# 10. Settlement Sequence

> **Signing authority (see Soroban Contract PRD §8 + Stellar Standards PRD ED-2/ED-10).** The platform account (`PLATFORM_WALLET_ADDRESS`) **signs and submits** the settlement transaction using the **`PLATFORM_WALLET_SECRET`** (held server-side, never exposed). Creators' wallets only **receive** — they do not co-sign settlements. This does not violate non-custodial design (Principle 3): the platform key moves the *buyer's* purchase funds per the split, never *creator* funds.

> **MVP funding model — pre-funded USDC float (ADR C1; see Stellar Standards PRD ED-9).** The buyer pays via **mock GCash**, so no real USDC is minted on payment. The `settle` contract therefore draws from a **pre-funded float** held by the platform account: the team tops up `PLATFORM_WALLET_ADDRESS` with testnet USDC out-of-band before the demo (Implementation Backlog **BC-011**). Each settlement draws the float down by the full purchase amount (−10 USDC: 9.50 creator, 0.50 credited to the platform balance). Top up before depletion or `settle` reverts on insufficient balance → `SETTLEMENT_FAILED` (§20). Production replaces the float with a real on-ramp that credits the account automatically.

```text
Buyer

↓

Checkout

↓

Order Created

↓

Payment Success

↓

SettlementService.execute()

↓

Soroban Contract

↓

95% Creator Wallet

5% Platform Wallet

↓

Receive txHash

↓

Verify Transaction

↓

Order SETTLED

↓

Transaction Record Created
```

---

# 11. Stellar Integration

> **RPC vs Horizon roles (see Stellar Standards PRD §6, §7).** Per the official Stellar Skills, **Soroban RPC is the primary** path for new code: contract invocation (`simulateTransaction` → `assembleTransaction` → `sendTransaction`) and settlement verification (`getTransaction(hash)`). **Horizon is secondary**, used for rich account balance reads (`loadAccount`) and explorer-facing transaction detail. Both clients come from the single `@stellar/stellar-sdk` package.

## Horizon

Purpose:

Query blockchain data.

Functions:

* getAccount()
* getBalance()
* getTransactions()

Used By:

Wallet Module

Settlement Module

---

## Soroban

Purpose:

Execute programmable revenue split.

Input:

10 USDC

Output:

9.50 Creator

0.50 Platform

Used By:

Settlement Service

> **USDC decimal scaling (see Stellar Standards PRD §3 / ED-7).** USDC on Stellar uses **7 decimals** (not 6 like EVM USDC): `$0.001 = 10000` base units. Kreav stores money as `Decimal(18,2)`; the SettlementService must scale between DB units and on-chain base units: `amount_base = amount_usd × 10^7`. A silent 10×/100× bug is the failure mode if this conversion is mishandled. Testnet USDC issuer `G...` = `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`; SAC contract `C...` = `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`.

---

## Freighter

Purpose:

Wallet ownership.

Used By:

Creator

Backend stores only public key.

---

# 12. Settlement Monitoring

Purpose:

Ensure settlement actually succeeded.

Flow:

Submit Transaction

↓

Receive txHash

↓

Query Horizon

↓

Transaction Found

↓

Status Success

↓

Mark Order SETTLED

If transaction not found:

↓

Retry Verification

If transaction failed:

↓

Mark Order FAILED

---

# 13. Error Catalog

## Wallet Not Connected

Condition:

Creator has no wallet.

Action:

Reject checkout settlement.

---

## Trustline Missing

Condition:

Creator wallet cannot hold USDC.

Action:

Prompt creator to enable USDC.

---

## Soroban Failure

Condition:

Contract execution failed.

Action:

Mark settlement FAILED.

---

## Horizon Timeout

Condition:

Horizon unavailable.

Action:

Retry query.

---

## Transaction Not Found

Condition:

Verification failed.

Action:

Retry verification.

---

# 14. Logging Strategy

All blockchain actions must be logged.

Examples:

Wallet Connected

Settlement Started

Settlement Verified

Settlement Failed

Withdrawal Requested

---

Example

```json
{
  "service": "SettlementService",
  "orderId": "123",
  "creatorId": "456",
  "txHash": "ABCDEF",
  "status": "completed"
}
```

---

# 15. Deployment

Frontend:

Docker container (Next.js standalone) behind Caddy — self-hosted VPS

Backend:

Docker container (NestJS) behind Caddy — self-hosted VPS

Database:

Neon (managed PostgreSQL)

Blockchain:

Stellar Testnet

Orchestration:

docker-compose (backend + frontend + Caddy auto-HTTPS); deployed via GitHub Actions SSH (`docker compose up -d --build`). See the Deployment PRD.

Required Environment Variables:

```env
DATABASE_URL=

HORIZON_URL=

SOROBAN_RPC_URL=

PLATFORM_WALLET_ADDRESS=

# Platform account SECRET key (S...) — sole server-side secret. Signs settlements.
# Held only by the SettlementService; never logged. See Stellar Standards ED-10.
PLATFORM_WALLET_SECRET=

USDC_ASSET_CODE=

USDC_ISSUER=

# Deployed Revenue Split contract address (C...) — see Soroban Contract PRD.
SPLIT_CONTRACT_ID=
```

---

# 16. Implementation Roadmap

## Phase 1

Backend Foundation

* NestJS
* Prisma
* PostgreSQL
* Product APIs

---

## Phase 2

Checkout Flow

* Orders
* Mock Payment
* Webhook

---

## Phase 3

Wallet Integration

* Connect Freighter
* Save Public Key

---

## Phase 4

Stellar Integration

* Horizon
* Soroban
* Revenue Split

---

## Phase 5

Creator Dashboard APIs

* Balance
* Transactions

---

## Phase 6

Withdrawal Flow

* Mock Anchor
* Withdrawal Tracking

---

# 17. Definition of Done

A creator can:

✓ Connect Freighter Wallet

✓ Create Product

✓ Receive Settlement

✓ View Balance

✓ View Transactions

✓ Verify Settlement On-Chain

A buyer can:

✓ Purchase Product

✓ Complete Checkout

System can:

✓ Execute Soroban Revenue Split

✓ Store Transaction Records

✓ Verify Settlement Through Horizon

✓ Display Explorer Transaction Hash

---

# Final Statement

Kreav Backend is a lightweight settlement orchestration layer built on NestJS, PostgreSQL, Soroban, and Horizon.

The backend manages products, orders, and settlement records while leveraging Stellar wallets for asset ownership and Soroban smart contracts for programmable revenue distribution.


---

# Kreav Backend PRD v3 Addendum — Additional Specifications for MVP

Version: 3.1

Status: Final (Addendum)

> This addendum extends **Kreav Backend PRD v3**. Where v3 and v3.1 conflict, **v3.1 wins**. It is part of the backend source of truth.

---

# 18. Notification Service

## Purpose

The Notification Service is responsible for sending transactional emails to buyers and creators.

Notifications are asynchronous and must never block the primary business flow.

---

## Email Provider

Provider:

* Resend

Reason:

* Simple REST API
* Generous free tier
* Excellent developer experience
* Easy integration with NestJS
* Can be replaced later using Adapter Pattern

---

## Architecture

```text
Application Service

↓

Notification Service

↓

Email Provider Adapter

↓

Resend API
```

Business modules must never call Resend directly.

All emails are sent through `NotificationService`.

---

## Email Events

### Creator

| Event                | Trigger                        |
| -------------------- | ------------------------------ |
| Welcome Email        | Creator registers              |
| Wallet Connected     | Wallet successfully connected  |
| Product Published    | Product becomes available      |
| Product Sold         | Successful settlement          |
| Settlement Completed | Blockchain settlement verified |
| Withdrawal Requested | Creator requests withdrawal    |
| Withdrawal Completed | Withdrawal succeeds            |

---

### Buyer

| Event                 | Trigger           |
| --------------------- | ----------------- |
| Purchase Confirmation | Payment succeeds  |
| Download Ready        | Product available |
| Refund Confirmation   | Future            |

---

## Notification Log

Notifications require durable retry state. A `NotificationLog` entity persists every notification attempt so failed jobs can be retried independently.

Fields:

* id
* recipient
* channel (EMAIL)
* event
* status (PENDING | SENT | FAILED)
* attempts
* last_error
* provider_message_id
* created_at
* updated_at

Reasoning:

* Retry requires durable state.
* Useful for debugging demo issues.
* Allows future support for SMS, Push, Discord, Telegram.
* Notification failures must never affect settlement.
* Notification processing remains asynchronous.

`NotificationLog` is infrastructure, not business data.

---

## Failure Policy

Email delivery failures must never cancel:

* Checkout
* Settlement
* Withdrawal

Failed email jobs should be retried independently.

---

# 19. Collaborative Revenue Split

## Purpose

A single product may belong to multiple creators.

Revenue should be distributed automatically according to predefined percentages.

This feature is executed by the Soroban Smart Contract.

---

## Example

```text
Product Price

10 USDC

↓

Platform Fee

5%

↓

Creator Pool

95%

↓

Creator A

70%

Creator B

20%

Creator C

10%
```

---

## Database

### ProductCollaborator

Fields

* id
* product_id
* wallet_address
* role (free-text: Author, Illustrator, Editor, Translator, Co-Creator, Affiliate, etc.)
* revenue_percentage
* status (enum: ACTIVE | INACTIVE)

Example

| Wallet      | Role     | Share |
| ----------- | -------- | ----: |
| Creator     | Author   |   70% |
| Illustrator | Designer |   20% |
| Editor      | Reviewer |   10% |

Design notes:

* Creator roles evolve faster than backend deployments — `role` is descriptive metadata (free-text), not application state.
* `status` is application state (enum: ACTIVE | INACTIVE) and is backend-controlled.

---

## Settlement Recording

A settlement is recorded as one canonical on-chain event with an accounting breakdown of every recipient.

* **Settlement** — one immutable blockchain settlement event (1 per settlement).
  Fields: id, order_id, total_amount, tx_hash, status, created_at
* **SettlementRecipient** — every recipient of the settlement (Creator, Platform, Affiliate, Treasury, etc.), N per settlement.
  Fields: id, settlement_id, wallet_address, recipient_type, role, percentage, amount

Reasoning:

* One Settlement = one blockchain transaction.
* Many SettlementRecipients = accounting distribution of that settlement.
* Naming is domain-driven and future-proof: it naturally supports future features (affiliate commissions, referrals, staking rewards, royalties, charities, treasury allocations) without schema change.

---

## Settlement Flow

Payment Received

↓

Backend verifies payment

↓

Invoke Soroban Contract

↓

Platform receives fee

↓

Creator Pool distributed

↓

Settlement verified

↓

Transaction recorded

---

## Design Principles

* Creator percentages must total 100% (within the creator pool).
* Platform fee configured separately.
* Revenue distribution is immutable after settlement.
* Backend validates percentages before contract execution.

---

# 20. Failure Handling

## Philosophy

Backend must always preserve financial consistency.

Money must never disappear because of application failure.

Every failure must produce a deterministic system state.

---

## Domain Model (v3.1)

The generic `Transaction` entity from v3 is removed. Domain events are modeled explicitly (Domain-Driven Design):

### Commerce Domain

* Order
* Settlement
* SettlementRecipient

### Wallet Domain

* Wallet
* Withdrawal

### Future Reputation Domain (out of MVP scope)

* Stake
* StakeReward
* SlashEvent

Reasoning: Settlement and Withdrawal are different business events with different lifecycles, responsibilities, and integrations. Each business event owns its own lifecycle instead of sharing a generic `Transaction` model.

### Withdrawal Entity

* id
* creator_id
* settlement_id (nullable)
* tx_hash
* amount
* status (enum: PENDING | COMPLETED | FAILED)
* created_at

---

## Failure Matrix

### Payment Failure

Cause: Buyer payment unsuccessful.

Result: Order Status `PAYMENT_FAILED`. No blockchain interaction.

---

### Duplicate Payment Webhook

Cause: Gateway retries webhook.

Action: Ignore duplicate using Payment Transaction ID. No duplicate settlement.

---

### Settlement Failure

Cause: Soroban execution fails.

Result: Order Status `SETTLEMENT_FAILED`.

Retry policy: Maximum three retries. If still failing: manual review required.

---

### Horizon Timeout

Cause: Network unavailable.

Result: Order Status `SETTLEMENT_PENDING`. Backend retries verification. If txHash exists later: Order becomes `SETTLED`.

---

### Wallet Not Connected

Cause: Creator has not connected wallet.

Result: Order Status `WAITING_WALLET`. Creator receives notification. Settlement delayed until wallet connected.

---

### Missing Trustline

Cause: Wallet cannot receive USDC.

Result: Settlement blocked. Frontend prompts creator to establish trustline. Retry after trustline creation.

> **On-chain mapping (see Soroban Contract PRD §3/§9).** A creator wallet without a USDC trustline causes the SAC `transfer` to fail with `op_no_trust`, which makes the whole settlement tx revert atomically (no partial payouts). State mapping: if detected **pre-settlement** (via Horizon `loadAccount` balance check) → Order `WAITING_WALLET` (deferred until trustline created); if it surfaces **mid-settle** (the contract revert) → Order `SETTLEMENT_FAILED` (retry up to 3× after the creator adds the trustline, then manual review).

---

### Withdrawal Failure

Cause: Anchor unavailable.

Result: Withdrawal Status `FAILED`. Creator funds remain inside wallet. No loss of funds.

---

### Notification Failure

Cause: Email provider unavailable.

Result: Retry notification later (via NotificationLog). Business transaction remains successful.

---

## Retry Policy

Automatic retries apply only to:

* Settlement Verification
* Horizon Requests
* Email Delivery

Maximum retries: 3

Exponential backoff recommended.

---

## Idempotency

Every payment webhook must contain a unique transaction identifier.

The backend must guarantee:

* One payment
* One settlement
* One transaction record

Repeated requests must never execute settlement twice.

---

## Order State Machine

Lifecycle:

```text
CREATED

↓

CHECKOUT_STARTED

↓

PAYMENT_PENDING

↓

PAYMENT_RECEIVED

↓

SETTLEMENT_PENDING

↓

SETTLED

↓

WITHDRAW_PENDING

↓

WITHDRAW_COMPLETED
```

Failure States:

```text
PAYMENT_FAILED

SETTLEMENT_FAILED

WITHDRAW_FAILED

WAITING_WALLET

CANCELLED
```

Only valid state transitions are allowed.
