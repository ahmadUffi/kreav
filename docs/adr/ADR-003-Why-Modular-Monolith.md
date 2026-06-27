# ADR-003: Why Modular Monolith

- **Status:** Accepted (immutable)
- **Date:** 2026-06-24
- **Supersedes:** none
- **Authoritative refs:** [Backend PRD](../backend/Backend-PRD.md) §5 (High-Level Backend Architecture), [Runtime Flow Bible](../architecture/Runtime-Flow-Bible.md) §17, [Deployment PRD](../backend/Deployment-PRD.md) §21

## Context

Kreav is a hackathon project with a ~3-person team and a ~3-minute demo target. The backend must orchestrate products, orders, settlement, wallets, withdrawals, and notifications without the operational overhead of distributed services.

## Problem

What backend topology balances speed-of-build, operational simplicity, and a credible path to scale?

## Decision

**NestJS modular monolith.** A single deployable unit with strictly bounded feature modules (`Products`, `Orders`, `Settlement`, `Wallet`, `Notification`, …) communicating via an in-process event bus (`@nestjs/event-emitter`). No microservices, no message broker in MVP.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| **Microservices** (settlement / wallet / notification as separate services) | Ops overhead (service discovery, inter-service auth, distributed tracing, N deploys) disproportionate to a 3-person hackathon team |
| **Serverless functions** | Cold starts + statelessness fight the in-process event bus and cron retry workers; harder local dev loop |

## Trade-offs

- **+** One deploy, one log stream, simple local dev, fast iteration.
- **+** Module boundaries make a future split possible without redesign.
- **−** In-process event bus loses in-flight events on crash → mitigated by the **startup recovery job** (audit #18, resumed by BE-012).
- **−** Horizontal scaling (N>1 instances) requires moving the bus + throttler + cron-lock to Redis (documented in [Deployment PRD §21](../backend/Deployment-PRD.md#21-container-lifecycle--scaling)).

## Consequences

- Throttler storage + event bus + retry state are in-process / DB-backed (no Redis in MVP).
- A startup recovery job must resume orders stuck in `PAYMENT_RECEIVED` / `SETTLEMENT_PENDING`.
- Scaling beyond one instance is a documented future step (not a blocker).

## References
- [Backend PRD](../backend/Backend-PRD.md) §5, §6 (Modules)
- [Runtime Flow Bible](../architecture/Runtime-Flow-Bible.md) §3 (DI), §17 (Why no Redis)
- [Deployment PRD](../backend/Deployment-PRD.md) §18–§21 (deploy strategy, scaling)
