# ADR-001: Why Stellar

- **Status:** Accepted (immutable)
- **Date:** 2026-06-24
- **Supersedes:** none
- **Authoritative refs:** [Backend PRD](../backend/Backend-PRD.md) §1–§2, [Stellar Standards PRD](../stellar/Stellar-Standards-PRD.md) §1, [System Architecture](../architecture/System-Architecture.md)

## Context

Kreav is a programmable settlement layer for digital-product creators: a buyer pays, a smart contract splits the revenue (95% creator / 5% platform), the creator receives USDC in their own wallet, verifiable on-chain. The choice of settlement chain is the most foundational decision in the system — it constrains asset availability, wallet UX, fee model, and the demo's reliability surface.

## Problem

Which blockchain provides the best fit for *creator payments*: fast verifiable settlement, a liquid stablecoin (USDC) movable by smart contract, low predictable fees, a non-custodial wallet ecosystem, and on-chain transparency — all demonstrable in a ~3-minute live demo?

## Decision

**Stellar** is the settlement layer. Specifically:
- USDC on Stellar Testnet (classic asset via the [SAC bridge](../stellar/Stellar-Standards-PRD.md#3-assets)).
- A single Soroban revenue-split contract performs the programmable split.
- Horizon for balance/explorer reads; Soroban RPC for contract invocation + verification.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| **Ethereum / EVM L2s** | Gas volatility + slower finality undermine a live settlement demo; USDC is wrapped/bridged rather than a native classic asset; higher latency for the "verify on-chain" moment |
| **Solana** | Fast, but its account/token model and wallet ecosystem are less aligned with the "creator connects their own wallet + receives USDC" UX; weaker stablecoin-as-classic-asset story |
| **Cosmos / app-chain** | Overkill — Kreav needs no sovereign consensus, only programmable settlement on an established network |

## Trade-offs

- **+** ~5s ledger finality → settlement + verification fit the demo window.
- **+** Real, liquid USDC as a classic asset (stable value, full wallet/explorer support).
- **+** Sub-cent fees → a 10 USDC settlement isn't eaten by gas.
- **+** Non-custodial wallet ecosystem (Freighter/LOBSTR) matches the security model.
- **−** Testnet reliability is a real demo risk (Horizon/Soroban occasionally down/rate-limited — Security-Audit #20).
- **−** RPC has a ~7-day history window (fine for the demo; a constraint for deep history).

## Consequences

- The backend integrates two Stellar clients (`rpc.Server` + `Horizon.Server`) from `@stellar/stellar-sdk` (ED-5).
- USDC requires trustlines on every receiving wallet — this drives the `WAITING_WALLET` order state and the pre-demo wallet/trustline setup (BC-011).
- Settlement transactions are real on testnet and must be verified via RPC `getTransaction` (not mocked).

## References
- [Stellar Standards PRD](../stellar/Stellar-Standards-PRD.md) §1 (Why Stellar), §3 (Assets), §7 (RPC)
- [Backend PRD](../backend/Backend-PRD.md) §11 (Stellar Integration)
- [Soroban Contract PRD](../stellar/Soroban-Contract-PRD.md) §1 (Philosophy)
