# ADR-006: Why SettlementRecipient (1 + N model)

- **Status:** Accepted (immutable)
- **Date:** 2026-06-24
- **Supersedes:** the generic `Transaction` entity from Backend PRD v3 (removed in v3.1 §20 — see [Final Consistency Report](../reviews/Final-Consistency-Report.md) cross-reference note 6)
- **Authoritative refs:** [Backend PRD](../backend/Backend-PRD.md) §19 (Settlement Recording), §20 (Domain Model), [Soroban Contract PRD](../stellar/Soroban-Contract-PRD.md) §4

## Context

Kreav supports **multi-collaborator** revenue split (v3.1 §19): a single settlement transaction pays the platform (5%) plus N collaborators from the creator pool (95%). The data model must capture one on-chain transaction and its accounting breakdown.

## Problem

How should the database model a settlement so that (a) each settlement maps 1:1 to an on-chain transaction, (b) the per-recipient distribution is auditable, and (c) the model never disagrees with what the contract actually did?

## Decision

**1 canonical `Settlement` row + N `SettlementRecipient` children.**
- `Settlement` = one immutable on-chain settlement event (one `txHash`, one `Order`, one total). One Settlement ↔ one blockchain transaction.
- `SettlementRecipient` = the accounting breakdown: every recipient (platform + each collaborator) with its `walletAddress`, `recipientType`, `role`, `percentage`, `amount`, `createdAt`.
- The rows are derived from the **contract's return value** — they mirror what the contract did, never an independent recompute.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| **Generic `Transaction` entity** (v3) | Conflated settlements + withdrawals; lost the multi-recipient breakdown; v3.1 §20 removed it |
| **JSON blob of recipients** on Settlement | Unqueryable, unauditable, no per-recipient constraints; defeats reconciliation |
| **One row per recipient, no canonical parent** | No single source of truth for the on-chain tx; hard to map N rows → 1 txHash |

## Trade-offs

- **+** Clean 1:1 Settlement:txHash mapping; per-recipient audit trail; queryable breakdown.
- **+** Mirrors the contract's output exactly → DB and chain never disagree.
- **−** More rows (1 + N per settlement) — negligible volume in MVP.
- **−** `SettlementRecipient` originally lacked `createdAt` — **fixed** (ADR H3 / audit #9; field now present).

## Consequences

- Every successful settlement writes 1 `Settlement` + N `SettlementRecipient` rows atomically.
- The `recipientType` enum has `CREATOR` + `PLATFORM` for MVP; `AFFILIATE`/`TREASURY` are reserved future values (not used — see schema doc-comment + [Final Architecture Review](../reviews/Final-Architecture-Review.md) M2).
- Reconciliation: the recorded `SettlementRecipient` set must match RPC `getTransaction(hash).returnValue` — a mismatch is a bug, not an ops nuisance.

## References
- [Backend PRD](../backend/Backend-PRD.md) §19 (Settlement Recording), §20 (Domain Model — Settlement/SettlementRecipient)
- [Soroban Contract PRD](../stellar/Soroban-Contract-PRD.md) §4 (Collaborator Split), §12 (Monitoring/reconciliation)
- [Final Architecture Review](../reviews/Final-Architecture-Review.md) H3 (createdAt resolution)
- [Database Bible](../database/Database-Bible.md) (entity details)
