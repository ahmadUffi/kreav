# ADR-002: Why Non-Custodial

- **Status:** Accepted (immutable)
- **Date:** 2026-06-24
- **Supersedes:** the conflicting "Sponsored Custodial Wallet" wording in [Product Scope](../product/Product-Scope.md) (resolved — see [Final Architecture Review](../reviews/Final-Architecture-Review.md) §Inconsistencies I1)
- **Authoritative refs:** [Backend PRD](../backend/Backend-PRD.md) §4 Principle 3, [Stellar Standards PRD](../stellar/Stellar-Standards-PRD.md) §0 + ED-1, [Security PRD](../security/Security-PRD.md) §15

## Context

Kreav pays creators in USDC. A platform that pays out must decide *who holds the keys* to creator wallets. Two early Kreav documents disagreed: the Backend PRD mandated non-custodial; the Product Scope described a "Sponsored Custodial Wallet."

## Problem

Should Kreav hold creator private keys / seed phrases (custodial), or should creators connect their own wallets and Kreav store only public keys (non-custodial)?

## Decision

**Non-Custodial.** The creator connects their own Freighter/LOBSTR wallet; the backend stores **only the public key (`G...`)** and the provider. The backend never holds funds, never stores secret keys / seed phrases, never does wallet custody.

This is the decided state (AGENTS.md "Source of truth & wallet strategy (DECIDED)"). It aligns with the Stellar wallet ecosystem's default security model (Stellar Skills — `dapp` skill).

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| **Custodial** (Kreav creates + holds creator keys) | A backend holding N creator keys is a centralized honeypot — the exact theft vector non-custodial design prevents. Also conflicts with the resolved wallet strategy. |
| **Hybrid** (custodial fallback for keyless creators) | Adds custody for some users, reintroducing the honeypot; complexity without demo value. |

## Trade-offs

- **+** No high-value key store to protect → Kreav is not a theft target for creator keys.
- **+** Aligns with Stellar ethos + the official Skills wallet model.
- **−** Creators must arrive with a funded + trustlined wallet → onboarding friction.
- **−** The demo needs a pre-configured creator wallet (no on-stage setup — Demo PRD failure condition).

## Consequences

- The `Wallet` model stores only `walletAddress` + `provider` (no secret columns — verified in schema).
- A creator with no wallet / no USDC trustline defers settlement → `WAITING_WALLET` order state.
- The **sole** secret the backend holds is `PLATFORM_WALLET_SECRET` (ADR-001's platform signing key — see [Security PRD §16](../security/Security-PRD.md#16-platform-wallet-security)). That key moves *buyer* funds per the split, never *creator* funds.
- Pre-demo: all creator wallets must be pre-funded + pre-trustlined (Security-Audit #21).

## References
- [Backend PRD](../backend/Backend-PRD.md) §4 Principle 3
- [Stellar Standards PRD](../stellar/Stellar-Standards-PRD.md) §0, §8, ED-1
- [Security PRD](../security/Security-PRD.md) §15 (Private Key Protection), §16 (Platform Wallet)
- [Final Architecture Review](../reviews/Final-Architecture-Review.md) §Inconsistencies (custodial conflict resolved)
