# Kreav — Hackathon Product Brief v1

## APAC Stellar Hackathon 2026

### Working Title

Kreav

### One-Liner

The easiest way for Southeast Asian creators to receive payments from anyone in Asia and manage their earnings through a unified creator wallet powered by Stellar.

---

# 1. Problem

Creators in Southeast Asia can already earn money from:

* Digital products
* Templates
* E-books
* Online courses
* AI prompts
* Design assets
* Sponsorships
* Consulting

However, receiving and managing that money is still fragmented.

Creators face:

* High cross-border payout fees
* FX conversion losses
* Multiple payment providers
* Delayed settlements
* Limited payout options
* Unsupported payout rails in certain countries

As a result, creators lose revenue before the money reaches their bank account.

---

# 2. Target User

## Primary User

Digital Product Seller

Examples:

* Notion template creator
* Prompt engineer
* AI educator
* E-book seller
* Designer selling assets
* Developer selling boilerplates
* Course creator

---

## Geography

Primary:

* Indonesia
* Philippines
* Vietnam

Secondary:

* Thailand
* Malaysia
* Singapore

---

# 3. Product Vision

Creators should not care:

* where the buyer is
* what payment method the buyer uses
* how money travels across borders

Creators should only care about:

"How much did I earn today?"

Kreav acts as the financial layer between buyers and creators.

---

# 4. MVP Scope (Hackathon)

This is NOT a full creator platform.

We are NOT building:

* Patreon
* Gumroad
* Ko-fi
* Marketplace
* Social platform

We are building:

## Creator Payment & Payout Infrastructure

The simplest possible version.

---

# 5. Core User Story

A creator from Indonesia sells a digital product.

A buyer from another country purchases the product.

The payment is settled through Stellar rails.

The creator receives funds instantly in their creator wallet.

The creator can:

* keep balance in USDC
* view earnings
* withdraw funds

---

# 6. Demo Scenario

## Creator

Selling:

"AI Interview Playbook"

Price:

10 USD

---

## Buyer

Country:

Philippines

Payment Method:

GCash (Mocked)

---

## Flow

Buyer opens product page

↓

Clicks Buy

↓

Completes payment

↓

Backend simulates local payment confirmation

↓

Funds converted to USDC

↓

Settlement happens through Stellar Testnet

↓

Creator wallet balance updates

↓

Creator sees earnings

↓

Creator withdraws funds

---

# 7. Why Stellar

Without Stellar:

* traditional cross-border rails
* multiple intermediaries
* higher settlement cost
* slower transfers

With Stellar:

* fast settlement
* low transaction costs
* stablecoin-based transfers
* global payment infrastructure

Stellar is not visible to the buyer.

Stellar powers the financial infrastructure behind the scenes.

---

# 8. Key Features

## Feature 1

Creator Storefront

Creator can:

* create product
* define price
* receive shareable link

---

## Feature 2

Checkout Experience

Buyer can:

* view product
* purchase product

For hackathon:

local payment flow may be mocked.

---

## Feature 3

Creator Wallet

Creator can:

* see balance
* view transactions
* see earnings history

---

## Feature 4

Stellar Settlement

System:

* sends funds through Stellar Testnet
* records transaction hash
* updates creator wallet

---

## Feature 5

Withdrawal Simulation

Creator can:

* withdraw USDC
* simulate payout to local bank

For hackathon:

actual payout may be mocked.

---

# 9. Success Criteria

A judge should understand the product within 30 seconds.

A judge should see:

* a creator
* a buyer
* a payment
* a wallet
* Stellar settlement

within the first 2 minutes of the demo.

---

# 10. Non-Goals

Not in Hackathon Scope:

* Creator social network
* Subscription platform
* Full Patreon competitor
* Real payment processor integrations
* Real banking integrations
* Advanced DeFi
* Lending
* Yield products

---

# 11. Architecture Overview

Buyer

↓

Checkout

↓

Backend

↓

Payment Event

↓

Stellar Service

↓

USDC Settlement

↓

Creator Wallet

↓

Withdrawal

---

# 12. Team Responsibilities

## Frontend

Responsible for:

* Landing page
* Product page
* Checkout page
* Creator dashboard
* Wallet dashboard

Additional support:

* UI/UX
* Demo polish
* Pitch visuals

---

## Backend

Responsible for:

* API
* User management
* Product management
* Transaction management
* Wallet records
* Stellar integration layer

Additional support:

* Architecture
* Demo narrative
* Technical presentation

---

## Smart Contract / Blockchain

Responsible for:

* Stellar setup
* Wallet creation
* Testnet assets
* Transaction execution
* Settlement proof
* Transaction hash tracking

Additional support:

* Backend integration
* Testnet deployment
* Demo environment setup

If smart contract scope becomes light:

Prioritize helping backend integration and demo reliability.

---

# 13. Demo Goal

At the end of the hackathon, judges should walk away with a simple understanding:

"A creator in Southeast Asia can receive payments and manage earnings through a unified wallet powered by Stellar."

That message is more important than technical complexity.

