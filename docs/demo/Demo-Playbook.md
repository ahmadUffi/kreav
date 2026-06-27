# Demo Playbook

> **Status:** The complete runbook for executing the Kreav hackathon demo end-to-end. The screen-by-screen script lives in [Demo PRD](../product/Demo-PRD.md); this Playbook covers **preparation + timeline + execution** so the demo never fails on logistics.
> **Authoritative refs:** [Demo PRD](../product/Demo-PRD.md), [Implementation Backlog](../backend/Implementation-Backlog.md) BC-010/BC-011, [Failure Recovery](./Failure-Recovery.md), [ADR C1](../reviews/Final-Architecture-Review.md) (float), [ADR-009](../adr/ADR-009-Why-Simulated-Payment-Provider.md) (simulated PSP).

## The canonical narrative (memorize this)

> **"For the hackathon, we simulate the payment provider because integrating every regional payment network is outside the scope of this MVP. Our backend is provider-agnostic: it only consumes verified payment events. In production, those events could come from GCash, PayMongo, Stripe, Xendit, or any compliant PSP. What is real in our demo is the settlement executed on Stellar Testnet."**

**Storytelling rules (never violate on stage):**
- Say **"simulated,"** never "fake." The payment event, webhook, and HMAC signature are all valid — only the buyer-side money movement is simulated.
- Say **"the backend verifies the signature,"** never "the backend trusts the webhook."
- The **payment provider is replaceable** (GCash/GoPay/Stripe…); **Stellar is the core infrastructure.** Kreav is a settlement layer, not a payment gateway.

## Demo target
**~3 minutes.** A buyer (Philippines) pays 10 USDC for "AI Interview Playbook" → Soroban splits → **9.50 USDC to the Indonesian creator / 0.50 to the platform** → creator sees balance + txHash + explorer link → simulated withdrawal completes.

**Audience focus:** money moving from buyer to creator, verifiable on-chain — *not* blockchain complexity.

## Timeline

| Phase | Duration | What happens |
|-------|----------|--------------|
| Problem intro | 20s | "Meet a creator from Indonesia selling a digital product" |
| Product purchase | 40s | Buyer discovers + pays via **Payment Simulator** (simulated GCash) |
| Stellar settlement | 40s | **WOW moment** — Soroban split animates (9.50 / 0.50) |
| Wallet update | 30s | Creator balance 0.00 → 9.50, txHash, explorer link |
| Withdrawal | 30s | Simulated withdrawal → "local bank" success |
| Closing | 20s | Recap + on-chain proof link + the canonical narrative |

## Pre-demo preparation (do this well before stage)

### 1. Wallet preparation (Security-Audit #21 — demo killer if skipped)
- [ ] **Creator wallet** (Indonesia): pre-funded with XLM (base reserve), **USDC trustline added**, a known USDC balance (0.00 to start). Freighter/LOBSTR, private key accessible to the presenter (or pre-connected).
- [ ] **Platform wallet** (`PLATFORM_WALLET_ADDRESS`): funded, USDC trustline, `PLATFORM_WALLET_SECRET` in the backend env.
- [ ] No on-stage wallet setup / seed phrases / KYC — ever (Demo PRD failure conditions).

### 2. Platform USDC float (ADR C1 — silent demo-killer)
- [ ] Platform account **pre-funded with enough testnet USDC** (BC-011) to cover ≥10 demo settlements (~100+ USDC). Acquire via the Circle testnet faucet.
- [ ] Verify the float via Horizon `loadAccount(PLATFORM_WALLET_ADDRESS)` — balance comfortably above expected usage.
- [ ] Have a **top-up faucet URL** bookmarked for a quick refill if needed.

### 3. Anchor mock
- [ ] Mock SEP-24 anchor responding `processing` → `completed` predictably (no real bank payout; the mock just transitions state).

### 4. Backend + chain readiness
- [ ] Backend deployed (Railway) + healthy (`/health`); DB migrated; demo data seeded (BE-011).
- [ ] Soroban split contract deployed on Testnet (`SPLIT_CONTRACT_ID` set in env).
- [ ] **Testnet reachability check** — RPC + Horizon responding (Security-Audit #20). Run a **dry-run settlement** and confirm it lands + verifies.

### 5. Contingency ready
- [ ] **Pre-recorded txHash backup** (a known-good settlement tx) in case Testnet is down mid-demo (Security-Audit #20).
- [ ] Stable internet (and a hotspot backup).
- [ ] Explorer link (StellarExpert/StellarChain) tested.

## Execution (on stage)

Follow the [Demo PRD](../product/Demo-PRD.md) 9-screen script. Key beats:
1. Creator dashboard — balance **0.00 USDC** (baseline).
2. Storefront → checkout → mock GCash.
3. **WOW**: payment webhook → Soroban settle → 9.50 / 0.50.
4. Creator wallet balance **9.50 USDC** + settlement record + **txHash**.
5. Click explorer link → on-chain proof.
6. Withdraw 9.50 → mock anchor → "completed" → local bank.

**Pacing rule:** if anything takes >5s, narrate ("settling on-chain, this takes a few seconds…") — never stand in silence. If a step hangs >15s, invoke [Failure Recovery](./Failure-Recovery.md).

## Post-demo
- Confirm no real funds left the creator's control (the mock anchor moved nothing).
- Note the txHash for any follow-up Q&A.

---

*Cross-reference: full screen script → [Demo PRD](../product/Demo-PRD.md); failure handling → [Failure Recovery](./Failure-Recovery.md); readiness checklist → [Demo Checklist](./Demo-Checklist.md).*
