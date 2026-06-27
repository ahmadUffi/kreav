# .ai/rules.md — Rules an AI Agent Must Never Violate

> **Purpose:** The non-negotiable guardrails. If an action conflicts with a rule here, the rule wins. Mirrors [`AGENTS.md`](../AGENTS.md) non-negotiables + the [Security PRD](../docs/security/Security-PRD.md) + the [Code Review Checklist](../docs/engineering/Code-Review-Checklist.md).
> **Keep ~300–500 lines.**

---

## Money
1. **Never use `number`/`float`/`parseFloat` for money.** Use `Prisma.Decimal` (services) and decimal strings (API boundary). A money bug is a fund-loss bug.
2. **Never recompute a settlement split the contract already performed.** Mirror the contract's return value into Settlement + SettlementRecipient.
3. **Never copy a money `Decimal` by reference** when persisting — construct a fresh `new Prisma.Decimal(value)`.
4. **USDC on-chain is 7 decimals.** Always scale DB `Decimal(18,2)` ↔ base units (`×10^7`) at the integration seam.
5. **Money writes that must be consistent are wrapped in a Prisma `$transaction`.**

## Custody & keys
6. **Never store, transit, or log a creator secret key / seed phrase.** The backend holds only public keys. The *sole* exception is `PLATFORM_WALLET_SECRET`, accessible only to `SettlementService`, never logged.
7. **Never create a wallet, fund an account reserve, or create a trustline on a creator's behalf.** Non-custodial (ADR-002).

## Settlement & retries
8. **Never re-invoke a `settle` that already returned `SUCCESS`.** Retries are on *verification* (`getTransaction`), not invocation. The contract `order_ref` guard is the last line of defense against double-settle.
9. **Never skip `simulateTransaction` → `assembleTransaction`.** A raw invoke is rejected by the network.
10. **Never trust a balance from the DB as authoritative.** Balance truth = live Horizon `loadAccount`.

## State & control flow
11. **Never make an Order transition outside the [state machine](../docs/architecture/Runtime-Flow-Bible.md#11-order-state-machine).** Illegal → `INVALID_STATE_TRANSITION`.
12. **Never block the business flow on a notification.** Notifications are async via the bus + `NotificationLog`; their failure never rolls back a settlement/withdrawal.
13. **Never treat a mock anchor's "completed" as an on-chain event.** Balance truth = Horizon.

## Security
14. **Never hard-code credentials** (DB passwords, API keys, wallet keys, secrets). Read from env; `.env` is gitignored.
15. **Never trust a webhook body before HMAC verification** (timing-safe, over the raw body).
16. **Never disable `whitelist` + `forbidNonWhitelisted`** on the ValidationPipe (mass-assignment protection).
17. **Never log secrets / full tokens / PII at error level.**
18. **Never introduce raw SQL.** Prisma parameterized queries only.

## Workflow
19. **Never auto-merge a PR.** CI green is a prerequisite, not a trigger; the user reviews + merges.
20. **Never merge with red CI.** No green = no merge, even if local checks pass.
21. **Never target `main` with a feature PR.** PRs go to `develop`.
22. **Never ship a `feat` without its test** (pragmatic TDD).
23. **Never commit `.env` or a migration that drops a populated table** without explicit approval.

## Scope
24. **Never write the Soroban contract source.** That's the BC team. The backend *invokes* it.
25. **Never build frontend code.** That's the FE team. (You may touch frontend docs only if asked.)
26. **Never invent APIs, SEPs, or Soroban mechanics not in the official Stellar Skills** — when in doubt, read skills.stellar.org.

## Contradictions
27. **On any conflict, follow the authority hierarchy:** official Stellar docs → Architecture Consistency Check → Final Architecture Review → Backend PRD → everything else. If you find a new contradiction, document it first (don't silently pick a side).

---

*Cross-reference: full standards → [Coding Standards](../docs/engineering/Coding-Standards.md); review rigor → [Code Review Checklist](../docs/engineering/Code-Review-Checklist.md); security controls → [Security PRD](../docs/security/Security-PRD.md).*
