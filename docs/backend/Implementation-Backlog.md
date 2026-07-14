# Kreav — Implementation Backlog v1

## APAC Stellar Hackathon 2026

---

# Sprint Goal

Deliver a working MVP that demonstrates:

* Product Purchase
* Payment Confirmation
* Soroban Revenue Split
* Stellar Settlement
* Creator Wallet Update
* Withdrawal Flow

---

# Team Structure

Frontend Engineer

Backend Engineer

Blockchain Engineer

---

# Priority Definitions

P0 = Required for Demo

P1 = Strongly Recommended

P2 = Nice to Have

---

# Sprint 1

## Foundation & Infrastructure

Target:

Application skeleton running end-to-end.

Estimated Duration:

Day 1 – Day 3

---

# Frontend Tasks

## FE-001

Title:

Initialize Frontend Project

Priority:

P0

Effort:

2 hours

Dependencies:

None

Deliverables:

* Next.js setup
* Tailwind setup
* Project structure

Status:

Required

---

## FE-002

Title:

Layout System

Priority:

P0

Effort:

4 hours

Dependencies:

FE-001

Deliverables:

* Navbar
* Container
* Shared Layout
* Page Routing

Status:

Required

---

## FE-003

Title:

Create Demo Navigation

Priority:

P0

Effort:

2 hours

Dependencies:

FE-002

Deliverables:

Pages:

* Storefront
* Checkout
* Dashboard
* Wallet

---

# Backend Tasks

## BE-001

Title:

Initialize Backend Project

Priority:

P0

Effort:

2 hours

Dependencies:

None

Deliverables:

* NestJS
* Config Module
* Environment Setup

---

## BE-002

Title:

Database Setup

Priority:

P0

Effort:

4 hours

Dependencies:

BE-001

Deliverables:

* PostgreSQL
* ORM
* Migration System

---

## BE-003

Title:

Core Entities

Priority:

P0

Effort:

6 hours

Dependencies:

BE-002

Deliverables:

Tables:

* User
* Product
* Order
* Wallet
* LedgerTransaction

---

# Blockchain Tasks

## BC-001

Title:

Stellar Testnet Setup

Priority:

P0

Effort:

2 hours

Dependencies:

None

Deliverables:

* Testnet Accounts
* Friendbot Funding

---

## BC-002

Title:

USDC Asset Setup

Priority:

P0

Effort:

3 hours

Dependencies:

BC-001

Deliverables:

* USDC Test Asset
* Issuer Account
* Distribution Account

---

## BC-003

Title:

Wallet Provisioning Script

Priority:

P0

Effort:

4 hours

Dependencies:

BC-001

Deliverables:

* Wallet Generator
* Trustline Creation

---

# Sprint 2

## Core Product Flow

Target:

Purchase → Settlement Flow

Estimated Duration:

Day 4 – Day 7

---

# Frontend Tasks

## FE-004

Title:

Storefront Page

Priority:

P0

Effort:

6 hours

Dependencies:

FE-003

Deliverables:

* Product Display
* Buy Button

---

## FE-005

Title:

Checkout Page

Priority:

P0

Effort:

4 hours

Dependencies:

FE-004

Deliverables:

* Mock GCash UI
* Payment Confirmation

---

## FE-006

Title:

Settlement Processing Screen

Priority:

P0

Effort:

4 hours

Dependencies:

FE-005

Deliverables:

* Processing Animation
* Settlement Timeline

---

# Backend Tasks

## BE-004

Title:

Product APIs

Priority:

P0

Effort:

4 hours

Dependencies:

BE-003

Endpoints:

* GET /products
* GET /products/:id

---

## BE-005

Title:

Checkout APIs

Priority:

P0

Effort:

6 hours

Dependencies:

BE-004

Endpoints:

* POST /checkout
* POST /webhooks/gcash

---

## BE-006

Title:

Event Bus Setup

Priority:

P0

Effort:

4 hours

Dependencies:

BE-005

Events:

* payment.received
* settlement.completed

---

## BE-007

Title:

Settlement Service

Priority:

P0

Effort:

8 hours

Dependencies:

BE-006

Deliverables:

* Stellar Integration Layer
* Settlement Trigger

---

# Blockchain Tasks

## BC-004

Title:

Soroban Contract Setup

Priority:

P0

Effort:

6 hours

Dependencies:

BC-002

Deliverables:

* Contract Repository
* Deployment Scripts

---

## BC-005

Title:

Revenue Split Contract

Priority:

P0

Effort:

8 hours

Dependencies:

BC-004

Logic:

Purchase

↓

95% Creator

↓

5% Platform

---

## BC-006

Title:

Contract Invocation API

Priority:

P0

Effort:

6 hours

Dependencies:

BC-005

Deliverables:

Backend Integration

---

# Sprint 3

## Wallet & Withdrawal

Target:

Complete Creator Experience

Estimated Duration:

Day 8 – Day 11

---

# Frontend Tasks

## FE-007

Title:

Creator Dashboard

Priority:

P0

Effort:

6 hours

Dependencies:

FE-006

Deliverables:

* Balance Card
* Product Card
* Earnings Display

---

## FE-008

Title:

Wallet Screen

Priority:

P0

Effort:

6 hours

Dependencies:

FE-007

Deliverables:

* Transaction History
* Settlement Records

---

## FE-009

Title:

Withdrawal Screen

Priority:

P0

Effort:

4 hours

Dependencies:

FE-008

Deliverables:

* Amount Input
* Withdraw Button

---

# Backend Tasks

## BE-008

Title:

Wallet APIs

Priority:

P0

Effort:

6 hours

Dependencies:

BE-007

Endpoints:

* GET /wallet/balance
* GET /wallet/transactions

---

## BE-009

Title:

Withdrawal APIs

Priority:

P0

Effort:

6 hours

Dependencies:

BE-008

Endpoints:

* POST /wallet/withdraw

---

## BE-010

Title:

Explorer Integration

Priority:

P1

Effort:

2 hours

Dependencies:

BE-009

Deliverables:

* Transaction URL
* Explorer Link

---

# Blockchain Tasks

## BC-007

Title:

Withdrawal Flow

Priority:

P0

Effort:

6 hours

Dependencies:

BC-006

Deliverables:

* Creator Wallet Transfer
* Treasury Transfer

---

## BC-008

Title:

Anchor Simulation

Priority:

P1

Effort:

4 hours

Dependencies:

BC-007

Deliverables:

* Mock SEP-24 Response
* Withdrawal Success

---

# Sprint 4

## Demo Hardening

Target:

Hackathon Ready

Estimated Duration:

Day 12 – Day 14

---

# Frontend Tasks

## FE-010

Title:

Demo Polish

Priority:

P0

Effort:

8 hours

Deliverables:

* Better Loading States
* Better Animations
* Better Empty States

---

## FE-011

Title:

Responsive Layout

Priority:

P1

Effort:

4 hours

---

# Backend Tasks

## BE-011

Title:

Demo Data Seeder

Priority:

P0

Effort:

2 hours

Deliverables:

* Creator
* Product
* Wallet
* Orders

---

## BE-012

Title:

Error Handling

Priority:

P1

Effort:

4 hours

---

## BE-013

Title:

Notification Module

Sprint:

3

Priority:

P1

Effort:

6 hours

Dependencies:

BE-006

Deliverables:

* Resend integration (Adapter Pattern — v3.1 §18)
* NotificationLog entity (durable retry state)
* @nestjs/schedule cron for retry (3× exponential backoff, dead-letter after 3)
* Async, non-blocking — notification failure never rolls back business tx
* Folds audit #19 (retry scheduling mechanism must survive restart — state in DB, not memory)

---

## BE-014

Title:

Email Event Wiring

Sprint:

4

Priority:

P1

Effort:

4 hours

Dependencies:

BE-013

Deliverables:

* Wire business events to email templates (v3.1 §18 Email Events):
  * Creator: settlement.completed → "You received X USDC", wallet.connect.required → "Connect your wallet", withdrawal status updates
  * Buyer: purchase confirmation
* NotificationLog lifecycle (PENDING → SENT | FAILED) fully exercised end-to-end
* Demo-ready email content for the settlement success notification

---

# Blockchain Tasks

## BC-009

Title:

Testnet Verification

Priority:

P0

Effort:

4 hours

Deliverables:

* Explorer Validation
* Tx Verification

---

## BC-010

Title:

Demo Transaction Preparation

Priority:

P0

Effort:

2 hours

Deliverables:

* Clean Wallet State
* Ready Demo Accounts

---

## BC-011

Title:

Platform USDC Float Pre-Funding

Sprint:

1

Priority:

P0

Effort:

2 hours

Dependencies:

BC-002

Deliverables:

* Acquire testnet USDC for the platform account (`PLATFORM_WALLET_ADDRESS`) via the Circle testnet faucet / Stellar testnet USDC distribution path
* Add a USDC trustline to the platform account
* Pre-fund the account with enough USDC to cover the expected demo volume (≥ ~10 settlements worth)
* Document the top-up procedure (who, how, the low-float alert threshold — Observability PRD)
* Resolves ADR C1 (pre-funded float model): the Soroban `settle` contract draws real testnet USDC from this float on every settlement because the buyer's GCash payment is mocked and mints no USDC

---

# Demo Readiness Checklist

## Must Work

✓ Product Page

✓ Checkout

✓ Mock Payment

✓ Settlement Trigger

✓ Soroban Split

✓ Creator Wallet Update

✓ Transaction History

✓ Transaction Hash

✓ Explorer Link

✓ Withdrawal Flow

---

# Can Be Mocked

✓ GCash

✓ Local Bank

✓ Anchor

✓ KYC

✓ Compliance

---

# Cannot Be Mocked

✓ Stellar Account

✓ Trustline

✓ USDC Asset

✓ Soroban Contract

✓ Revenue Split

✓ On-Chain Transaction

✓ Transaction Hash

✓ Wallet Balance

---

# Definition of Done

A buyer purchases a digital product.

The purchase triggers a Soroban smart contract.

The contract automatically splits revenue.

The creator receives funds in a Stellar wallet.

The transaction can be verified on-chain.

The creator successfully withdraws earnings through the demo flow.

This is the minimum winning demo for Kreav.

