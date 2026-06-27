# ADR-004: Why Soroban

- **Status:** Accepted (immutable)
- **Date:** 2026-06-24
- **Supersedes:** none
- **Authoritative refs:** [Backend PRD](../backend/Backend-PRD.md) §4 Principle 2, [Soroban Contract PRD](../stellar/Soroban-Contract-PRD.md) §1–§2, [Stellar Standards PRD](../stellar/Stellar-Standards-PRD.md) §1

## Context

Kreav's core value is *programmable* revenue split — the rule that 95% goes to the creator and 5% to the platform must be enforced by code that neither party can alter, verifiable on-chain.

## Problem

Where should the split logic live so it is trust-minimized, verifiable, and atomic — and how much on-chain logic does Kreav actually need?

## Decision

**A single Soroban (Rust) smart contract** — the Revenue Split Contract — performs the split. It is the **only** smart contract Kreav ships in MVP. The contract reaches USDC via the [Stellar Asset Contract (SAC)](../stellar/Stellar-Standards-PRD.md#3-assets) bridge.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| **Backend does the split** (off-chain transfers) | Not trust-minimized — the backend operator could mis-divert funds; violates "settlement is verifiable on-chain" |
| **Custom Soroban token** instead of USDC via SAC | Loses ecosystem liquidity/wallet support; the Skills explicitly prefer classic assets unless custom logic is needed (ED-3) |
| **Multiple contracts** (escrow, staking, dispute, …) | Over-engineering for MVP; all are explicitly [Future scope](../stellar/Soroban-Contract-PRD.md#15-future-contracts-future-scope-only--not-mvp) |

## Trade-offs

- **+** The split is enforced on-chain and verifiable by anyone (the demo's "wow" + the trust anchor).
- **+** Atomicity: all recipient transfers succeed or the whole tx reverts — no partial payouts.
- **+** USDC via SAC means standard SEP-41 token interface, full wallet/explorer support.
- **−** Contract correctness is critical → pre-mainnet it needs formal verification / audit (Soroban Audit Bank).
- **−** Adds a Rust contract to the stack (BC team owns it; backend only *invokes*).

## Consequences

- Kreav ships exactly one contract (`settle`) in MVP; no on-chain staking/escrow/dispute.
- The backend **mirrors** the contract's output into `Settlement` + `SettlementRecipient` rows — it never recomputes a split the contract already performed ([Soroban Contract PRD §1](../stellar/Soroban-Contract-PRD.md#1-philosophy)).
- Contract security follows the soroban skill Part 3 checklist: `require_auth`, SAC allowlist, checked arithmetic, typed storage keys, `order_ref` idempotency.

## References
- [Soroban Contract PRD](../stellar/Soroban-Contract-PRD.md) §1 (Philosophy), §2 (Inventory), §9 (Security)
- [Backend PRD](../backend/Backend-PRD.md) §4 Principle 2, §11 (Soroban), §19 (Collaborative Split)
- [Stellar Standards PRD](../stellar/Stellar-Standards-PRD.md) §3 (Assets/SAC), ED-3
