# KREAV
### *Creator Economy, Borderless Payment*
**Stellar APAC Hackathon 2026 — Track 3: Payment Consumer Applications**

---

## Slide 1 — The Problem

**Content creators in Asia cannot get paid by their own regional fans.**

An Indonesian creator has 100,000 subscribers. 30% of them are in the Philippines and Vietnam. Yet there is no simple way for those fans to support the creator directly.

- Saweria & Trakteer? Limited to Indonesian fans only
- PayPal? Not widely usable in Indonesia, requires credit cards
- Wise? Minimum transfer thresholds are too high for micro-payments
- Stripe? Does not support Indonesia for creator onboarding

> **The fans are there. The content is there. But the financial corridor connecting cross-border fans to creators is broken.**

---

## Slide 2 — Market Size

| Metric | Data |
|---|---|
| Active content creators in Asia | 50 million+ |
| Asian creator economy value 2025 | $104 billion USD |
| Average lost tips due to missing payment rails | Rp5,000 – Rp200,000 (~$0.30–$13 USD) per transaction |
| Feasible cross-border micro-payment solutions today | Near zero |

**No platform currently solves cross-border creator payments in Asia using local payment methods.**

---

## Slide 3 — Introducing Kreav

**Kreav is an Asian creator economy platform enabling fans anywhere to pay creators using their local payment methods — settled via the Stellar blockchain in seconds.**

```
kreav.com/creatorname
```

Creators receive a dedicated profile page to:
- Sell digital products (e-books, presets, templates, courses)
- Receive tips from global fans
- Accept one-time or recurring payments

**Like Lynk.id + Gumroad — but operating seamlessly across borders.**

---

## Slide 4 — How It Works

### For Creators
```
1. Register on Kreav
2. Connect a Stellar wallet (Freighter / Lobstr)
3. Upload digital products & set prices
4. Share your link: kreav.com/name
5. Funds settle directly into your wallet — no manual withdrawal needed
```

### For Fans / Buyers
```
1. Open the creator's link
2. Choose a product or tip amount
3. Pay via local payment methods:
   🇮🇩 QRIS  |  🇵🇭 GCash  |  🇻🇳 VietQR  |  🌏 and others
4. Confirm — get instant access to the digital product
5. Done. No registration, no crypto wallet required
```

---

## Slide 5 — Why Stellar

Kreav is not a "crypto app." Stellar acts as the **behind-the-scenes infrastructure** — fans and creators never interact with crypto complexity.

| Metric | PayPal | Wise | **Kreav (Stellar)** |
|---|---|---|---|
| Fee | 4–5% | 0.5–2% | **~0.000005 USD/tx** |
| Settlement | 1–3 days | Minutes–hours | **3–5 seconds** |
| Micro-tip (e.g. $0.30) | ❌ Uneconomical | ❌ Uneconomical | **✅ Economical** |
| Fan requires credit card | ✅ Yes | ✅ Yes | **❌ No** |
| Cross-border scope | ⚠️ Limited | ⚠️ Limited | **✅ Global** |

> *"Funds never touch Kreav servers. They move directly from fan to creator wallet via Stellar."*

---

## Slide 6 — Architecture

```
FAN                          STELLAR                    CREATOR
────                         ───────                    ───────

Pay QRIS/GCash/VietQR
        │
        ▼
   Local Anchor          ──► USDC Settlement ──►     Creator Anchor
   (confirms to                                      (withdraws to
    Kreav webhook)                                    local bank)
        │                                                  │
        ▼                                                  ▼
   Kreav verifies on                              Funds settle to
   Stellar ledger                                 creator wallet (Freighter)
        │
        ▼
   Digital product link
   delivered to fan
```

**On-chain fee split:** Every transaction splits automatically — 95% to creator wallet, 5% to Kreav — in a single atomic Stellar transaction. Transparent and tamper-proof.

**Stellar DEX:** When no direct asset path exists (e.g., PHP → IDR), the Stellar DEX auto-swaps via USDC as an intermediary. Built-in, no custom AMM needed.

---

## Slide 7 — What's On-Chain vs Off-Chain

**On-chain (Stellar) — permanent verification:**
- Settlement payment from fan → creator
- 95/5 fee split inside one atomic transaction
- Unique memo as the payment ID per transaction
- Verifiable transaction history on Stellar Explorer

**Off-chain (Kreav database) — application context:**
- Creator profiles & pages
- Digital product catalog data
- Notifications & dashboard metrics
- UI history & analytics

> *90% of Kreav is a standard web app. Stellar is invoked at exactly one point — when the payment settles.*

---

## Slide 8 — Composability

Kreav does not reinvent the wheel. Kreav **builds upon** the existing Stellar ecosystem:

| Building Block | Existing Infrastructure | Kreav Usage |
|---|---|---|
| Wallet | Freighter, Lobstr | Creators connect existing wallets |
| Settlement currency | USDC on Stellar | No new token creation |
| On/off-ramp | Anchors per country | Fiat ↔ Stellar gateways |
| Liquidity & swap | Built-in Stellar DEX | Automated currency swapping |
| Protocol | SEP-6 / SEP-24 | Standard anchor interactions |

**Post-hackathon roadmap:** Kreav's payment widget can be embedded into other platforms (Lynk.id, Trakteer, etc.) as their settlement layer.

---

## Slide 9 — Business Model

**Revenue: 5% platform fee per successful transaction**

- Fee deducted on-chain — atomic, transparent, tamper-proof
- No subscriptions, no hidden fees
- Creators and fans know exactly what is deducted

| Metric | Value |
|---|---|
| Fee rate | 5% per transaction |
| Stellar tx cost | ~$0.000005 (massive profit margin) |
| Break-even volume | ~4,000 transactions/month (avg $3 USD/tip) |
| TAM Asian creators | 50 million+ creators |

**Why 5% is competitive:**
- Trakteer/Saweria: 5–10%
- PayPal: 4–5% + fixed fee + FX spreads
- Kreav: 5% flat, zero FX spreads, zero hidden fees

---

## Slide 10 — Product Integrity

**How does Kreav prevent creator fraud with invalid links?**

**MVP Phase (Hackathon):**
- Creator verification via email + phone number
- Buyer rating & review system
- Dispute mechanism — fraudulent creators banned, funds frozen
- On-chain transaction hash serves as permanent receipt for buyers

**Roadmap:**
- Hosted file uploads — creators upload directly to Kreav storage instead of external links
- Buyers download files directly from Kreav servers immediately after payment confirmation

---

## Slide 11 — Alignment with Hackathon

| Hackathon Criteria | Kreav Implementation | Status |
|---|---|---|
| User-facing financial app | Creator profile pages + dashboard | ✅ |
| Payment app people can use | Fans pay without login or crypto wallet | ✅ |
| Connect to local economy | QRIS, GCash, VietQR, and others | ✅ |
| Integrate with local anchors | Country anchors form core architecture | ✅ |
| Use local assets | USDC on Stellar + local fiat | ✅ |
| On/off-ramps | Fan on-ramp, creator off-ramp | ✅ |
| Plug into existing wallets | Freighter / Lobstr | ✅ |
| DeFi & liquidity | Stellar DEX for automated swaps | ✅ |
| Composability | Embeddable payment layer | ✅ |

---

## Slide 12 — Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React / Next.js |
| Backend | NestJS / Node.js |
| Database | PostgreSQL |
| Blockchain | Stellar Horizon SDK |
| Settlement | USDC on Stellar |
| Anchor | SEP-6 / SEP-24 compatible anchors |
| Wallet | Freighter (desktop), Lobstr (mobile) |
| DEX | Built-in Stellar DEX |
| Local Payments | Midtrans (ID), GCash API (PH), VietQR (VN) |

---

## Slide 13 — Demo Target

**Minimum verifiable demo flow:**

- [ ] Creator registers, connects Freighter wallet, and uploads 1 digital product
- [ ] Fan from "the Philippines" opens creator page, pays via simulated GCash
- [ ] Anchor confirms → Kreav verifies on Stellar ledger
- [ ] 95/5 fee split executes on-chain within one atomic transaction
- [ ] Fan receives instant access to the digital product
- [ ] Transaction hash is verifiable on the **Stellar Testnet Explorer**
- [ ] Creator views incoming settlement in dashboard

**All demo transactions run on Stellar Testnet — publicly verifiable.**

---

## Slide 14 — Roadmap

```
NOW (Hackathon MVP)
├── Creator profile page
├── Digital product + tips
├── QRIS, GCash, VietQR
├── Stellar settlement + on-chain fee split
└── Stellar DEX auto-swap

POST-HACKATHON (Grant Phase)
├── Mainnet deployment
├── Hosted file storage (anti-fraud)
├── Mobile apps (iOS + Android)
├── Anchor expansion across Asian countries
└── Kreav as payment SDK/widget for third-party platforms

LONG-TERM
├── Creator memberships/subscriptions
├── Live streaming + virtual gifts
├── Advanced creator analytics dashboard
└── B2B: White-label payment infrastructure for Asia
```

---

## Slide 15 — Why Us, Why Now

**Why Kreav:**
- Team directly understands Southeast Asian creator pain points
- Built upon proven, robust Stellar infrastructure
- Non-custodial — zero custody risk, zero regulatory blockers
- UX hides all blockchain complexity from end users

**Why Now:**
- Asian creator economy has grown 3x in the last 3 years
- Cross-border QRIS expansion validates regional demand for seamless cross-border payments
- Stellar ecosystem maturity — anchors, USDC, and DEX are ready for production use

---

## One-Liner

> **Kreav — Sell your content. Get paid by anyone, from anywhere.**

---

*Kreav | Stellar APAC Hackathon 2026 | kreav.com*
