# Kreav — Demo PRD v1

## APAC Stellar Hackathon 2026

---

# Objective

Create a 3-minute demo that clearly demonstrates:

1. Digital product purchase
2. Cross-border payment flow
3. Programmable settlement
4. Stellar integration
5. Soroban revenue split
6. Creator wallet update
7. Withdrawal flow

Judges should understand the product within 30 seconds.

---

# Demo Narrative

## Story

An Indonesian creator sells a digital product.

A buyer from the Philippines purchases the product.

The payment is settled using Stellar.

The creator instantly receives earnings.

The revenue is automatically split using Soroban.

The creator withdraws earnings.

---

# Demo Characters

## Creator

Country:
Indonesia

Name:
Creator

Product:
AI Interview Playbook

Price:
10 USD

---

## Buyer

Country:
Philippines

Payment Method:
GCash (Mocked)

---

# Demo Timing

| Section              | Duration |
| -------------------- | -------- |
| Problem Introduction | 20 sec   |
| Product Purchase     | 40 sec   |
| Stellar Settlement   | 40 sec   |
| Wallet Update        | 30 sec   |
| Withdrawal           | 30 sec   |
| Closing              | 20 sec   |

Total:

~3 Minutes

---

# Screen 1 — Creator Dashboard

## Purpose

Establish initial state.

Show creator has not received any earnings yet.

---

## User

Creator

---

## Data Displayed

Balance:

0.00 USDC

Products:

AI Interview Playbook

Price:

10 USD

---

## UI Elements

* Current Balance
* Product Card
* Settlement History

---

## Demo Script

"Meet a creator from Indonesia selling a digital product."

"At this moment, the creator has earned nothing."

---

## Backend

GET /wallet/balance

GET /products

---

## Blockchain

No transaction yet.

---

# Screen 2 — Public Storefront

## Purpose

Show the buyer experience.

---

## User

Buyer

---

## URL

/products/:id

---

## Data Displayed

Product Name

AI Interview Playbook

Price

10 USD

---

## UI Elements

* Product Information
* Buy Button

---

## Demo Script

"A buyer from the Philippines discovers the product."

---

## Backend

GET /products/:id

---

## Blockchain

No transaction yet.

---

# Screen 3 — Checkout

## Purpose

Demonstrate payment initiation.

---

## User

Buyer

---

## Data Displayed

Product

AI Interview Playbook

Price

10 USD

Country

Philippines

Payment Method

GCash

---

## UI Elements

* Mock GCash Checkout
* Confirm Payment Button

---

## Demo Script

"The buyer pays using a familiar local payment method."

---

## Backend

POST /checkout

POST /webhooks/gcash

---

## Database

Order

Status:

PAID

---

## Blockchain

No settlement yet.

---

# Screen 4 — Settlement Processing

## Purpose

Show the Stellar magic.

This is the WOW MOMENT.

---

## UI Elements

Processing Animation

Settlement Timeline

---

## Visual Flow

Buyer Payment

↓

Settlement Triggered

↓

Soroban Contract

↓

95% Creator

↓

5% Platform

---

## Demo Script

"Once payment is confirmed, a Soroban smart contract automatically executes a programmable revenue split."

---

## Backend

Event:

payment.received

↓

Settlement Service

---

## Blockchain

Invoke Soroban Contract

---

## Expected Result

10 USDC

↓

9.50 USDC

Creator

↓

0.50 USDC

Platform

---

# Screen 5 — Settlement Success

## Purpose

Show proof of settlement.

---

## UI Elements

Success State

Transaction Hash

Settlement Receipt

---

## Data Displayed

Amount

9.50 USDC

Network

Stellar Testnet

Status

Completed

---

## Demo Script

"The transaction is settled on Stellar within seconds."

---

## Backend

settlement.completed

---

## Blockchain

Transaction Confirmed

---

# Screen 6 — Creator Wallet

## Purpose

Show updated creator earnings.

---

## User

Creator

---

## Data Displayed

Previous Balance

0.00 USDC

New Balance

9.50 USDC

---

## Transaction List

Settlement

+9.50 USDC

Status

Completed

---

## Demo Script

"The creator instantly receives earnings without waiting days for settlement."

---

## Backend

GET /wallet/balance

GET /wallet/transactions

---

## Blockchain

Query Horizon

---

# Screen 7 — Blockchain Proof

## Purpose

Prove transaction exists on-chain.

---

## UI Elements

Transaction Hash

Explorer Link

---

## Demo Script

"We can verify the transaction directly on Stellar."

---

## User Action

Click Transaction Hash

---

## Result

Open Stellar Explorer

Display:

* Transaction Hash
* Sender
* Receiver
* Amount

---

# Screen 8 — Withdrawal

## Purpose

Show off-ramp experience.

---

## User

Creator

---

## UI Elements

Withdraw Button

Amount Input

Bank Selection

---

## Data Displayed

Available Balance

9.50 USDC

---

## Demo Script

"The creator can withdraw earnings to their local financial system."

---

## Backend

POST /wallet/withdraw

---

## Blockchain

Withdrawal Transaction

---

## Anchor

SEP-24 Flow

or

Mock Anchor Flow

---

# Screen 9 — Withdrawal Success

## Purpose

Complete the lifecycle.

---

## UI Elements

Withdrawal Receipt

Success State

---

## Data Displayed

Amount

9.50 USDC

Destination

Local Bank

Status

Completed

---

## Demo Script

"The creator has successfully converted digital settlement into usable local funds."

---

# Blockchain Events

## Event 1

Payment Received

---

## Event 2

Settlement Triggered

---

## Event 3

Soroban Split Executed

---

## Event 4

Settlement Confirmed

---

## Event 5

Withdrawal Requested

---

## Event 6

Withdrawal Completed

---

# Demo Success Criteria

The audience must clearly see:

✓ Product Purchase

✓ Local Payment

✓ Stellar Settlement

✓ Soroban Smart Contract

✓ Revenue Split

✓ Creator Wallet

✓ Transaction Hash

✓ Withdrawal Flow

within 3 minutes.

---

# Demo Failure Conditions

Avoid:

* Long loading times
* Complex onboarding
* Wallet setup during demo
* Seed phrases
* Blockchain jargon
* Technical implementation details

The audience should focus on:

Money moving from buyer to creator.

Not on blockchain complexity.

---

# Demo One-Sentence Summary

A buyer purchases a digital product, a Soroban smart contract automatically splits revenue, settlement occurs on Stellar, and the creator instantly receives earnings in a unified wallet.

