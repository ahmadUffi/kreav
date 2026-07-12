# Kreav — Final Product Scope (Hackathon MVP)

## APAC Stellar Hackathon 2026

---

# Product Name

Kreav

---

# One-Liner

Kreav is a programmable settlement layer for digital product creators powered by Stellar.

---

# Problem Statement

Creators in Southeast Asia can already sell digital products.

However, receiving and managing earnings across borders remains fragmented.

Creators face:

* Cross-border payout fees
* FX conversion losses
* Delayed settlements
* Multiple payout systems
* Fragmented earnings management
* Limited access to international payment rails

As a result, creators lose money and visibility into their earnings before funds reach their local bank accounts.

---

# Target User

## Primary User

Digital Product Seller

Examples:

* Notion Template Seller
* AI Prompt Seller
* Ebook Creator
* Course Creator
* Design Asset Seller
* Boilerplate Seller
* Digital Resource Creator

---

# Core Value Proposition

Creators should not care:

* Where buyers come from
* Which local payment method buyers use
* How money moves across borders

Creators should only care about:

> How much did I earn today?

Kreav provides:

* Unified earnings wallet
* Programmable settlement
* Cross-border payout infrastructure
* Transparent transaction records

---

# Product Vision

Enable creators across Southeast Asia to receive and manage earnings through a single programmable settlement layer powered by Stellar.

---

# MVP Scope

The MVP focuses exclusively on payment settlement and payout infrastructure.

Kreav is NOT a creator marketplace.

Kreav is NOT a social platform.

Kreav is NOT a Patreon competitor.

Kreav is NOT a Gumroad competitor.

---

# User Roles

## Creator

Can:

* Create products
* Generate storefront links
* View wallet balance
* View settlement history
* Withdraw earnings

---

## Buyer

Can:

* Open product page
* View product information
* Purchase product
* Complete checkout flow

---

# Feature Scope

---

## Feature 1 — Product Creation

Creator creates a digital product.

Example:

Product Name:
AI Interview Playbook

Price:
$10

Required Fields:

* Product Name
* Description
* Price

Out of Scope:

* Categories
* Reviews
* Ratings
* Analytics
* SEO

---

## Feature 2 — Public Storefront

Example URL:

/p/ai-interview-playbook

Displays:

* Product Name
* Description
* Price
* Buy Button

Out of Scope:

* Creator discovery
* Recommendations
* Search engine
* Community features

---

## Feature 3 — Checkout Flow

Buyer purchases a product.

Hackathon Version:

Mocked local payment flow.

Example:

Buyer Country:
Philippines

Payment Method:
GCash (Mocked)

Flow:

Buyer clicks Buy

↓

Payment Success

↓

Settlement Triggered

---

## Feature 4 — Programmable Revenue Split

Settlement occurs through Stellar.

Revenue split is executed automatically through Soroban.

Example:

Purchase Amount:
10 USDC

Settlement:

95%

↓

Creator Wallet

5%

↓

Platform Wallet

This feature demonstrates programmable money using Stellar.

---

## Feature 5 — Creator Wallet

Creator can view:

* Current Balance
* Settlement History
* Transaction Records
* Withdrawal History

Wallet displays:

* USDC Balance
* Transaction Hash
* Settlement Status

Out of Scope:

* Portfolio Tracking
* Investment Features
* Yield Products
* Trading

---

## Feature 6 — Withdrawal Flow

Creator initiates withdrawal.

Flow:

Creator Clicks Withdraw

↓

Withdrawal Request

↓

Anchor Simulation

↓

Local Bank Transfer Simulation

Hackathon Version:

Withdrawal is partially mocked.

Goal:

Demonstrate on-ramp/off-ramp flow.

---

# Stellar Usage

Stellar serves as the settlement layer.

Used For:

* Asset Transfer
* Wallet Balances
* Settlement Records
* Transaction Verification
* Revenue Distribution

---

# Soroban Usage

Soroban powers:

Programmable Revenue Split

Purchase Amount

↓

Smart Contract

↓

95% Creator

↓

5% Platform

This is the primary smart contract implementation.

---

# Wallet Strategy

MVP Strategy:

Non-Custodial (creator-supplied wallet)

> **Revised (see Kreav Backend PRD §4 Principle 3 + Stellar Standards PRD §0).** The earlier "Sponsored Custodial Wallet" wording is superseded. Non-Custodial is the decided state — it aligns with the Stellar wallet ecosystem's security model (a backend that holds creator secret keys is a high-value theft target) and with the Backend PRD's principle that the backend never holds funds or private keys.

The creator connects their own Freighter/Lobstr wallet; Kreav's backend stores **only the public key**. The creator is responsible for:

* Creating + funding the account (XLM reserve)
* Creating the USDC trustline (required to receive settlement — see Kreav Soroban Contract PRD)
* Keeping their secret key secure (Kreav never sees it)

Kreav does NOT:

* Create wallets on the creator's behalf
* Hold or transit secret keys / seed phrases
* Move creator funds out of their wallet (only the creator, or a real anchor they authorize, can do that)

For the demo, the Indonesian creator comes with a pre-configured, pre-funded, pre-trustlined wallet so there is no on-stage wallet setup.

---

# Anchor Strategy

MVP:

Mocked On-Ramp

Mocked/Simulated Off-Ramp

Production Vision:

Local Payment Rail

↓

Anchor

↓

Stellar Settlement

↓

Anchor

↓

Local Bank

---

# Demo Scenario

Creator:

Indonesia

Product:

AI Interview Playbook

Price:

10 USD

Buyer:

Philippines

Payment Method:

GCash (Mocked)

---

# Demo Flow

Step 1

Creator Dashboard

Balance:
0 USDC

---

Step 2

Buyer opens storefront

---

Step 3

Buyer purchases product

---

Step 4

Mock payment succeeds

---

Step 5

Soroban executes settlement

95%

↓

Creator Wallet

5%

↓

Platform Wallet

---

Step 6

Creator wallet updates

Balance:
9.50 USDC

---

Step 7

Transaction hash displayed

---

Step 8

Open Stellar Explorer

---

Step 9

Creator withdraws earnings

---

Step 10

Withdrawal success

---

# Success Criteria

Judges should understand the product within 30 seconds.

Judges should clearly see:

* Buyer
* Creator
* Payment
* Stellar Settlement
* Smart Contract Split
* Wallet
* Withdrawal

within the first 3 minutes of the demo.

---

# Non-Goals

Not Included In MVP:

* Marketplace
* Social Features
* Followers
* Subscriptions
* Creator Discovery
* Affiliate Systems
* Real Bank Integrations
* Real GCash Integrations
* Advanced DeFi
* Lending
* Yield
* Multi-Currency Wallet
* Mobile Application

---

# Product Scope Statement

Kreav is not a creator platform.

Kreav is a programmable cross-border settlement infrastructure for digital product creators powered by Stellar.

