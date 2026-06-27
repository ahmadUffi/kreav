# ADR-009: Why Simulated Payment Provider for MVP

- **Status:** Accepted (immutable, MVP-scoped)
- **Date:** 2026-06-27
- **Supersedes:** the informal "Mock GCash" framing — formalizes it as a **Payment Simulator** component (simulated PSP)
- **Authoritative refs:** [ADR-008](./ADR-008-Why-Mock-Anchor-for-MVP.md) (sibling — mock anchor), [Backend PRD](../backend/Backend-PRD.md) §3, [Demo PRD](../product/Demo-PRD.md), [API Standards](../api/API-Standards.md) §11 (webhook rules)

## Context

Kreav is a **settlement layer**, not a payment gateway. In production, the "payment received" event would originate from a real PSP (GCash, PayMongo, Stripe, Xendit, Adyen, GoPay, PayNow…). For the hackathon MVP, integrating even one regional PSP requires regulatory compliance, merchant onboarding, KYC, and bank rails — all explicitly out of scope ([Product Scope](../product/Product-Scope.md) non-goals).

## Problem

How do we model the *buyer pays* step so that:
1. The demo flows end-to-end (buyer → payment → settlement).
2. The backend treats the payment event exactly as it would from a real PSP (provider-agnostic).
3. The settlement (the part Kreav owns) is fully real on testnet.
4. The architecture clearly separates the **simulated** layer (payment provider) from the **real** layer (wallet, contract, USDC, on-chain tx).
5. A future swap to a real PSP is a drop-in replacement with zero backend changes.

## Decision

**Introduce a Payment Simulator component** that acts as a simulated PSP, decoupled from both the storefront UI and the backend.

```
Buyer → Storefront UI → Payment Simulator → signed payment event → Kreav Backend → Soroban Settlement (real)
```

The Payment Simulator is a **frontend-owned component** with two parts:
- **UI:** a realistic payment-method selector + confirmation screen ("Kreav Checkout": GCash, Maya, GoPay, OVO, DANA, PayNow…).
- **API route:** `POST /api/payments/simulate` — accepts `{ orderId, amount, method }`, simulates processing, generates a `paymentRef`, **HMAC-signs a payment event**, and POSTs it to the backend webhook. The storefront **never** calls the backend webhook directly.

### Backend stays provider-agnostic

The backend consumes a typed `PaymentReceivedEvent` — it does not know or care which PSP sent it. The only requirement is a valid HMAC signature over the raw body (audit #11). A future real PSP (Stripe/PayMongo) sends the same event shape with its own signature; the backend's verification step is the only thing that changes.

```ts
// The event the backend consumes — provider-agnostic
interface PaymentReceivedPayload {
  orderId: string;
  amountUsd: string;       // decimal string
  creatorId: string;
  walletAddress?: string;  // creator's wallet if known
  paymentRef: string;      // PSP's transaction id (idempotency key)
}
```

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| **Storefront calls backend webhook directly** | Unrealistic — in the real world a merchant's storefront never sends its own payment webhook. Couples the storefront to the webhook contract; weak Q&A defense ("why does the frontend send the webhook?"). |
| **Integrate a real PSP** | Out of MVP scope (regulatory, KYC, merchant onboarding — Product Scope non-goals). |
| **No payment step at all** (auto-trigger settlement) | Removes a key demo beat; doesn't show the payment→settlement handoff. |

## Trade-offs

- **+** Clear bounded-context separation: **Payment Domain** (simulated, replaceable) vs **Settlement Domain** (real, core).
- **+** The strongest Q&A narrative: *"the payment provider is simulated and replaceable; the settlement on Stellar is real."*
- **+** Backend is provider-agnostic by construction — adding GoPay/Stripe later = new PSP sending the same event, zero backend change.
- **+** The Payment Simulator mirrors real PSP architecture (UI → API → signed webhook → merchant backend).
- **−** One extra frontend route to build (small).
- **−** The buyer's "payment" produces no real money — the platform account is pre-funded (ADR C1/ED-9) and each settlement draws from that balance.

## Consequences

- The storefront never calls `POST /webhooks/gcash` directly — only the Payment Simulator does (with an HMAC signature).
- The backend's webhook endpoint (`POST /webhooks/gcash`) is **unchanged** — it already verifies HMAC + handles idempotency (BE-005, shipped).
- The webhook path name (`/webhooks/gcash`) is historical; it accepts any provider's signed event. A rename to `/webhooks/payment` is a cosmetic future cleanup (logged in [API Standards](../api/API-Standards.md)).
- Documentation/diagrams must show the **Payment Simulator** as a distinct actor between the storefront and the backend (not "frontend calls webhook").
- The storytelling rule: **"simulated," never "fake."** The payment event, webhook, and signature are all valid — only the money movement on the buyer side is simulated.

## The canonical narrative (for the team + judges)

> "For the hackathon, we simulate the payment provider because integrating every regional payment network is outside the scope of this MVP. Our backend is provider-agnostic: it only consumes verified payment events. In production, those events could come from GCash, PayMongo, Stripe, Xendit, or any compliant PSP. What is real in our demo is the settlement executed on Stellar Testnet."

## References
- [ADR-008](./ADR-008-Why-Mock-Anchor-for-MVP.md) — the sibling decision (mock anchor for off-ramp)
- [Backend PRD](../backend/Backend-PRD.md) §3 (Withdrawal/Payment flow), §9 (webhook endpoint), §11
- [Stellar Standards PRD](../stellar/Stellar-Standards-PRD.md) ED-9 (pre-funded float — why no real buyer money is needed)
- [Security PRD](../security/Security-PRD.md) §7 (webhook HMAC verification)
- [Demo PRD](../product/Demo-PRD.md) Screen 3 (Checkout)
- [Sequence Diagram Bible](../architecture/Sequence-Diagram-Bible.md) §6, §7, §30 (updated to show Payment Simulator)
