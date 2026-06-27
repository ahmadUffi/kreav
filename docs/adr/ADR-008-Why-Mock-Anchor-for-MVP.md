# ADR-008: Why Mock Anchor for MVP

- **Status:** Accepted (immutable, MVP-scoped)
- **Date:** 2026-06-24
- **Supersedes:** none
- **Authoritative refs:** [Backend PRD](../backend/Backend-PRD.md) §3 (Withdrawal Flow), [Anchor PRD](../stellar/Anchor-PRD.md) §0–§1, ED-6; [Implementation Backlog](../backend/Implementation-Backlog.md) (BC-008)

## Context

A real anchor (fiat↔Stellar bridge) requires KYC, bank integration, regulatory compliance, and a regulated partner — none of which fit a hackathon MVP scope (see [Product Scope](../product/Product-Scope.md) non-goals).

## Problem

How does Kreav handle the on-ramp (buyer fiat → USDC) and off-ramp (creator USDC → local bank) for the demo without building real banking/KYC infrastructure — while keeping the settlement (the part Kreav owns) fully real?

## Decision

**Mock the anchor for MVP.** The settlement in the middle is **real on testnet**; the on-ramp (GCash) and off-ramp (creator → bank) are **simulated**.
- The mock anchor implements the **shape** of SEP-24 (hosted flow + status polling) so the frontend code paths are identical when a real anchor replaces it.
- The creator's settlement receipt is real (9.50 USDC lands in their wallet, verifiable on-chain); only the bank payout is mocked.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| **Real anchor integration** | Needs a regulated anchor partner + SEP-12 KYC + bank rails — all out of MVP scope (Product Scope non-goals) |
| **No off-ramp at all** | Removes a key demo beat ("creator withdraws earnings") |

## Trade-offs

- **+** Demo shows the real settlement end-to-end without banking infrastructure.
- **+** Mock's SEP-24 shape means a real anchor is a drop-in replacement later.
- **−** Off-ramp is simulated — the demo must not imply the bank transfer is real.
- **−** Coupled to the **pre-funded USDC float** (ADR C1 / ED-9): since the on-ramp is mocked (no USDC minted), the platform account is pre-funded by the team (BC-011); the float depletes ~−10 USDC/sale.

## Consequences

- The `Withdrawal` entity exists but its bank-side flow is mock in MVP.
- Production replaces the mock with a real SEP-6/SEP-24 anchor + SEP-12 KYC (at the anchor, not Kreav) + SEP-38 quotes — all [Future scope](../stellar/Anchor-PRD.md#15-future-roadmap).
- The pre-funded float (C1) is an MVP/ops mechanism; production replaces it with real on-ramp credits.

## References
- [Anchor PRD](../stellar/Anchor-PRD.md) §0 (context), §1 (anchor overview), §15 (future roadmap)
- [Stellar Standards PRD](../stellar/Stellar-Standards-PRD.md) ED-6, ED-9 (float)
- [Backend PRD](../backend/Backend-PRD.md) §3 (Withdrawal Flow), §20 (Withdrawal failure matrix)
- [Final Architecture Review](../reviews/Final-Architecture-Review.md) C1 (float funding gap)
