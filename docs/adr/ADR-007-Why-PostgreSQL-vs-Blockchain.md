# ADR-007: Why PostgreSQL vs Blockchain (state separation)

- **Status:** Accepted (immutable)
- **Date:** 2026-06-24
- **Supersedes:** none
- **Authoritative refs:** [Backend PRD](../backend/Backend-PRD.md) §4 Principles 1–2, [System Architecture](../architecture/System-Architecture.md) principles, [Runtime Flow Bible](../architecture/Runtime-Flow-Bible.md) §17

## Context

A settlement system has two kinds of state: **application state** (users, products, orders, withdrawal records) and **settlement state** (wallet balances, trustlines, the split transaction). Where each lives determines query speed, trust, and operational complexity.

## Problem

Which state belongs in PostgreSQL and which on the Stellar chain — and why not unify them (e.g., mirror all balances in the DB)?

## Decision

**Strict separation:**
- **PostgreSQL = application state** — Users, Products, ProductCollaborators, Orders, Settlements, SettlementRecipients, Wallets, Withdrawals, NotificationLogs. This is the system of record for app data and accounting history.
- **Stellar = settlement state** — wallet balances, trustlines, the split transaction, txHash truth.
- **Balance truth is always a live Horizon read** — Kreav never stores a creator's USDC balance as authoritative; the chain is the source of truth for money.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| **Mirror balances in Postgres** | Drifts from the chain; a cached balance can lie about money; reconciliation burden; violates "chain = settlement state" |
| **Store everything on-chain** | Prohibitively expensive/slow for app data (product titles, emails); the chain is for settlement, not CRUD |
| **No DB (stateless backend)** | Cannot record orders/settlements/notifications; no queryable history; no app state for the demo |

## Trade-offs

- **+** Each system does what it's good at: Postgres for fast CRUD/accounting, chain for immutable money truth.
- **+** Balance reads are always honest (live Horizon).
- **−** Two sources of truth for a settlement: the DB row + the on-chain tx — kept consistent by mirroring the contract's return value (ADR-006).
- **−** DB failures don't affect money (chain is safe); chain failures affect settlement but not app data.

## Consequences

- The backend never recomputes a settlement split (ADR-006); it records what the contract did.
- `GET /wallet/balance` is a live Horizon read (with a stale-label fallback on timeout).
- The DB is durable history + accounting; the chain is the immutable money record. Both must agree on any settlement.

## References
- [Backend PRD](../backend/Backend-PRD.md) §4 Principles 1–2, §1 (backend responsibilities)
- [System Architecture](../architecture/System-Architecture.md) (Architecture Principles)
- [Database Bible](../database/Database-Bible.md) (PostgreSQL philosophy)
- [Observability PRD](../backend/Observability-PRD.md) §18 (failure investigation: logs/DB/chain must agree)
