# Kreav — Product Roadmap

## Vision

**Kreav is cross-border settlement infrastructure for digital product creators, built on Stellar.** A buyer pays → a Soroban smart contract automatically splits 95% to the creator / 5% to the platform → the creator receives USDC in their own wallet within seconds, verified on-chain. The rails are **global**; Southeast Asia is the initial target market, not a technical boundary.

This is not a one-off hackathon project. The trajectory is clear and phased: **secure on-chain foundation → real fiat money rails (on/off-ramp) → product depth → mainnet & compliance readiness.** Each phase adds usable value rather than piling on features. The business model is simple and sustainable — a **5% settlement fee** as infrastructure, without holding creator funds (non-custodial → no custody or regulatory risk as an intermediary).

---

## Summary Status

Legend: ✅ completed · 🚧 in progress · 🔜 planned

| Phase | Focus | Status |
|---|---|---|
| 0 | Core on-chain settlement (end-to-end demo) | ✅ |
| 1 | Identity & security (SEP-10 + JWT) | ✅ |
| 1.5 | Sponsored onboarding (CAP-33) | ✅ |
| 2 | Real money rails (on/off-ramp) | 🚧 SEP-24 off-ramp running on testnet · on-ramp next |
| 3 | Product delivery & engagement | 🚧 email active · secure file delivery next |
| 4 | Trust, compliance & scale (pre-mainnet) | 🔜 |

---

## Established Foundation

What makes Kreav work in practice today (not mocked):

- **✅ Real on-chain settlement** — checkout → webhook (HMAC signature verified) → `payment.received` event → invoke Soroban (build → simulate → sign → submit → poll) → record Settlement, with startup recovery if crash mid-settlement. The revenue-split contract is **deployed on Testnet** (`SPLIT_CONTRACT_ID` configured) and initialized.
- **✅ Secure identity (Phase 1)** — creator login via **SEP-10** (challenge signature in Freighter) → JWT session; `JwtAuthGuard` + `@CurrentUser()` across all endpoints (identity derived from token, replacing `creatorId`/`userId` query params). Truly non-custodial — the server only stores public keys.
- **✅ Sponsored onboarding (Phase 1.5, CAP-33)** — one-click "Activate USDC" banner; **fee + trustline reserve covered by platform** (native sponsored reserves, anti-blind-sign), plus trustline pre-check before settlement to prevent on-chain reverts.
- **✅ SEP-24 off-ramp (Phase 2A, on testnet)** — interactive withdrawal to a Stellar anchor (SEP-10 + SEP-24), creator signs the USDC transfer in Freighter; result includes txHash + explorer link. Active via `ANCHOR_ENABLED` flag, tested against SDF test anchor.
- **✅ Delivery & verification** — product link delivered via email (Resend) after settlement; every on-chain action has a txHash + stellar.expert link; balances read live from Horizon.
- **✅ Verified SC↔BE↔FE quality** — `is_settled` pre-check + `TRY_AGAIN_LATER` handling, DB mirror = contract math (remainder absorbs dust), `MAX_RECIPIENTS`=10 guard, 500 bps fee & 7-decimal USDC aligned across SC/BE/FE.

---

## Current & Planned Development

### Phase 2 — Production Money Rails 🚧
The off-ramp is running on testnet; the next steps are promoting it to production and adding real fiat on-ramps.

- **2A · Off-ramp → production (MoneyGram Ramps).** The only verified path covering **ID + VN + PH simultaneously** (off-ramp across 174 countries), and **aligned with our architecture** — protocols use SEP-10 (existing) + SEP-24 (implemented), using USDC on Stellar. Remaining blockers are **business, not technical**: **wallet allowlisting** for sandbox + **KYB & legal agreements** for production (business.moneygram.com). Applied for in parallel with development. Future option: **SEP-31** for B2B corridors, and new local anchors as they become available in the directory.
- **2B · On-ramp: Local fiat PSPs.** Buyers do not hold USDC, so the entry point uses PSPs (not SEP-24 anchors): PH → GCash/Maya, ID → Xendit/Midtrans (QRIS/VA/e-wallet), VN → MoMo/ZaloPay. Pattern remains: PSP webhook → `payment.received` → settle; platform maintains the USDC float (`float-monitor.service.ts`). Starting with one corridor.
- **2C · Failure/refund flows.** `PAYMENT_FAILED`, settlement timeouts, and off-chain refund policies (on-chain settlement is immutable).

### Phase 3 — Product Delivery & Engagement 🚧
Turning the platform from money transfer into true product commerce.
- **Secure file delivery** 🔜 — authorized access to `Product.fileUrl` after `SETTLED` (signed URL / time-bounded download token), replacing plain email links.
- **Notifications** ✅/🚧 — email product links already active; expanding `NotificationLog` (creator notification when settlement completes).
- **Analytics** 🔜 — real period-over-period delta calculation (currently partially `0`).

### Phase 4 — Trust, Compliance & Scale (Pre-Mainnet) 🔜
- **KYC/AML (SEP-12)** for production anchor compliance.
- **Observability** — structured logging, metrics, alerting; platform **XLM** float thresholds (sponsorship locks 0.5–1.5 XLM/creator) + USDC float monitoring.
- **Contract hardening on redeploy** — atomic `initialize` / `__constructor` (front-run prevention), handling idempotency marker restore (TTL ~30 days), consistent `ArithmeticOverflow` error mapping.
- **Multi-token & configurable fees** — upgrade path (5% fee currently `PLATFORM_FEE_BPS`); support SAC assets beyond USDC.
- **Mainnet cutover** — public passphrase & explorer URL (backend already `EXPLORER_URL`-configurable), platform key rotation, load/soak testing for batch settlements.

---

## Sustainability Model

Why this continues running beyond the demo:
- **Revenue embedded in the product** — 5% fee taken on-chain during every settlement; transaction volume scales revenue directly without separate billing overhead.
- **Low operational overhead** — non-custodial (no holding creator funds → no custody/escrow/regulatory burden as intermediary), lightweight infra (VPS + Docker + Caddy + Neon), Stellar rails cost ~sub-cent per transaction.
- **Global expansion built-in** — rails are global by default; expansion means adding on/off-ramp corridors, not rewriting core logic.
- **Modular technical foundation** — auth, settlement, sponsorship, and off-ramp modules are reusable building blocks across phases.

---

## Execution & Verification Notes

- **Workflow:** follow `AGENTS.md` — one issue = one branch (`be/<slug>` / `fe/<slug>`) = one PR into `develop`, Conventional Commits, DoD (clean lint + build + test), green CI before merge.
- **Core principles:** money is always Decimal/string, strictly non-custodial, every on-chain action exposes txHash + explorer link.
- **Phase verification:** end-to-end scenarios on Testnet + `integration/scripts/99-acceptance.ts`; negative auth e2e (Phase 1); `pnpm test`/`pnpm test:e2e` (backend) + `npm run build` (frontend) passing in CI on every PR.

