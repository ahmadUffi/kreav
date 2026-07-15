# Demo Checklist

> **Status:** The go/no-go checklist, run **immediately before** stepping on stage. All boxes must be ✅ or the demo is at risk.
> **Authoritative refs:** [Demo Playbook](./Demo-Playbook.md), [Implementation Backlog](../backend/Implementation-Backlog.md) (BC-009/BC-010/BC-011), [Failure Recovery](./Failure-Recovery.md).

## Cannot-be-mocked (must be REAL on testnet)
- [ ] **Stellar accounts** (creator + platform) exist + funded.
- [ ] **USDC trustlines** on creator + platform wallets.
- [ ] **USDC asset** resolvable (issuer/SAC correct).
- [ ] **Soroban split contract** deployed (`SPLIT_CONTRACT_ID` valid).
- [ ] **Revenue split** executes (dry-run settled + verified).
- [ ] **On-chain transaction** + **txHash** produced.
- [ ] **Wallet balance** reads correctly via Horizon.

## Can-be-mocked (must still function)
- [ ] **GCash** mock returns a valid HMAC-signed webhook.
- [ ] **Local bank** payout simulated by the mock anchor.
- [ ] **Anchor** returns `processing` → `completed`.
- [ ] **KYC / compliance** — none on stage.

## Infrastructure readiness
- [ ] **Backend** deployed (VPS · Docker Compose) + `/health` green; DB migrated.
- [ ] **Demo data** seeded (BE-011): Indonesian creator + "AI Interview Playbook" $10 + wallet connected.
- [ ] **`PLATFORM_WALLET_SECRET`** set in env.
- [ ] **`GCASH_WEBHOOK_SECRET`** set in env (REQUIRED on stage — no dev escape hatch).
- [ ] **Platform USDC float** topped up (≥ ~100 USDC; BC-011) — verified via Horizon.
- [ ] **Testnet RPC + Horizon** reachable (Security-Audit #20).
- [ ] **Internet** stable + hotspot backup ready.

## Demo-failure-condition guard (Demo PRD)
- [ ] **No long loading** (>5s gets narration; >15s triggers recovery).
- [ ] **No complex onboarding** on stage.
- [ ] **No wallet setup on stage** — wallets pre-connected.
- [ ] **No seed phrases** shown.
- [ ] **No blockchain jargon** — audience focus is "money moved, verifiable."
- [ ] **No technical implementation details** unless asked.

## Contingency ready
- [ ] **Pre-recorded txHash backup** loaded (Testnet-down fallback).
- [ ] **Explorer link** tested (StellarExpert/StellarChain).
- [ ] **Top-up faucet URL** bookmarked (low float).

## Go / No-Go
**If every "Cannot-be-mocked" + "Infrastructure readiness" box is ✅ → GO.** Any ❌ in those sections → fix before stage, or prepare to lean on the contingency (recorded txHash + narrated flow).

---

*Cross-reference: preparation detail → [Demo Playbook](./Demo-Playbook.md); if something fails → [Failure Recovery](./Failure-Recovery.md).*
