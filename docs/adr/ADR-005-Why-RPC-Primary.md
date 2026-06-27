# ADR-005: Why RPC Primary

- **Status:** Accepted (immutable)
- **Date:** 2026-06-24
- **Supersedes:** the Backend PRD's earlier "Horizon + Soroban RPC as equals" framing (refined — see [Backend PRD §11](../backend/Backend-PRD.md#11-stellar-integration))
- **Authoritative refs:** [Stellar Standards PRD](../stellar/Stellar-Standards-PRD.md) §6–§7, ED-4; [Backend PRD](../backend/Backend-PRD.md) §11

## Context

The official Stellar Skills (`data` skill) are explicit: **Stellar RPC is the preferred entry point for new projects; Horizon is legacy/historical.** Kreav is new code touching both Soroban (contract invoke/verify) and classic reads (balances, explorer).

## Problem

Which client should be primary for each Stellar interaction, to follow official guidance and keep the integration maintainable?

## Decision

**Soroban RPC is primary; Horizon is secondary.**
- **RPC** (`rpc.Server`): contract invocation (`simulateTransaction` → `assembleTransaction` → `sendTransaction`), settlement verification (`getTransaction(hash)`), contract events (`getEvents`).
- **Horizon** (`Horizon.Server`): rich account balance reads (`loadAccount` — for `GET /wallet/balance` + pre-settlement trustline checks) and explorer-facing transaction detail.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| **Horizon for everything** | Cannot submit/verify Soroban transactions or read contract events; legacy per the Skills |
| **RPC for everything** | RPC's `getAccount` is terser than Horizon's `loadAccount`; balance + trustline authorization status is richer from Horizon |

## Trade-offs

- **+** Follows official Stellar Skills guidance (skills win on Stellar mechanics per the authority hierarchy).
- **+** Clear role separation: write-path (RPC) vs read/display-path (Horizon).
- **−** Two clients from the SDK to maintain (both in `@stellar/stellar-sdk` — ED-5).
- **−** RPC has a ~7-day history window; verification must run promptly after settlement (fine for the demo).

## Consequences

- The backend instantiates `rpc.Server(SOROBAN_RPC_URL)` and `Horizon.Server(HORIZON_URL)` — both lazy (don't block boot on Testnet flakiness).
- Settlement submission + verification always go through RPC; balance/explorer go through Horizon.
- The pattern `simulate → assemble → sign → submit → poll getTransaction` is mandatory (Skills — [API Standards](../api/API-Standards.md)).

## References
- [Stellar Standards PRD](../stellar/Stellar-Standards-PRD.md) §6 (Horizon), §7 (RPC), ED-4
- [Backend PRD](../backend/Backend-PRD.md) §11 (Stellar Integration — RPC vs Horizon roles)
- [Runtime Flow Bible](../architecture/Runtime-Flow-Bible.md) §6–§7
