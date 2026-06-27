# Error Codes

> **Status:** Canonical machine-readable error catalog. Maps every backend error to a stable `code`, HTTP status, and recovery.
> **Provenance note:** Backend PRD §13 defines errors as **prose** (Condition/Action). This catalog introduces the **machine `code`** layer that §13 lacks (Security-Audit #12 confirms no domain exception hierarchy exists yet — BE-012 builds it). These codes are the binding contract the BE-012 `DomainException`/`FinancialException` hierarchy will emit.
> **Authoritative refs:** [Backend PRD §13](../backend/Backend-PRD.md) (Error Catalog), [§20 Failure Matrix](../backend/Backend-PRD.md), [Order state machine](../architecture/Runtime-Flow-Bible.md#11-order-state-machine).

---

## Error response schema

Every `4xx`/`5xx` response uses this shape:

```json
{
  "statusCode": 400,
  "code": "INVALID_STATE_TRANSITION",
  "message": "Order cannot transition from SETTLED to PAYMENT_RECEIVED",
  "details": { "from": "SETTLED", "to": "PAYMENT_RECEIVED" }
}
```

- `code` — `SCREAMING_SNAKE_CASE`, stable, machine-consumable (the contract).
- `message` — human-readable; may change between versions.
- `details` — optional structured context (free-form object).
- NestJS's default error shape is normalized by the global exception filter (BE-012).

---

## Error catalog

| `code` | HTTP | Trigger / condition | Resulting state | Retry? | Ref |
|--------|------|---------------------|-----------------|--------|-----|
| `VALIDATION_ERROR` | 400 | DTO validation failed (`whitelist`/`forbidNonWhitelisted`/regex) | none | no | §13 |
| `INVALID_STATE_TRANSITION` | 400 | Order transition rejected by the state machine | unchanged | no | [state machine](../architecture/Runtime-Flow-Bible.md#11-order-state-machine) |
| `INVALID_SIGNATURE` | 401 | Webhook HMAC verification failed (`/webhooks/gcash`) | none | no | §13, audit #11 |
| `ORDER_NOT_FOUND` | 404 | Webhook/checkout references an unknown order | none | no | §13 |
| `PRODUCT_NOT_FOUND` | 404 | `GET /products/:id` or checkout references unknown product | none | no | §13 |
| `WAITING_WALLET` | 200* | Payment received but creator has no wallet/trustline → deferred | Order `WAITING_WALLET` | n/a (resume on connect) | §13, §20 |
| `PAYMENT_FAILED` | 200* | Buyer payment unsuccessful | Order `PAYMENT_FAILED` (terminal) | buyer retries (new order) | §20 |
| `SETTLEMENT_FAILED` | 200* | Soroban execution failed (simulate-error / tx FAILED / insufficient float) | Order `SETTLEMENT_FAILED` | up to 3×, then manual | §13, §20, C1 |
| `SETTLEMENT_PENDING` | 200* | Horizon/RPC timeout mid-verify | Order `SETTLEMENT_PENDING` | retry verify (not re-invoke) | §20 |
| `WITHDRAW_FAILED` | 200* | Anchor unavailable / withdrawal callback failed | Withdrawal `FAILED`; funds safe | creator retries | §20 |
| `NOTIFICATION_FAILED` | — | Email (Resend) send failed | NotificationLog `FAILED` | up to 3× (cron), then dead-letter | §18 |
| `RPC_TIMEOUT` | 502/504 | Soroban RPC unreachable during invoke/verify | Order `SETTLEMENT_PENDING` | retry verify | §13, §20 |
| `HORIZON_TIMEOUT` | 502/504 | Horizon unreachable (balance read) | stale cached balance returned | retry read | §13 |
| `CONTRACT_REVERT` | 200* | Settlement tx reverted on-chain (e.g. `op_no_trust`, insufficient source balance) | Order `SETTLEMENT_FAILED` | up to 3× after fix, then manual | §20, [Soroban Contract PRD §9](../stellar/Soroban-Contract-PRD.md) |
| `INSUFFICIENT_FLOAT` | 200* | Platform USDC float depleted → contract `transfer` reverts | Order `SETTLEMENT_FAILED` | top up float (BC-011) | C1, ED-9 |
| `RATE_LIMITED` | 429 | Throttler limit hit (checkout/webhook/withdraw) | none | back off | audit #7 |
| `INTERNAL_ERROR` | 500 | Unhandled exception | unchanged | no | — |

> *`200` on `WAITING_WALLET`/`PAYMENT_FAILED`/`SETTLEMENT_*`/`WITHDRAW_FAILED`: the **webhook itself** returns 200 (it acked the event); the failure is reflected in the Order/Withdrawal state, surfaced via `GET /wallet/transactions` or the settlement result. A direct synchronous API call that fails returns the matching `4xx`/`5xx`.

---

## Mapping to the Order state machine

The codes align 1:1 with the [13-state machine](../architecture/Runtime-Flow-Bible.md#11-order-state-machine) failure/deferral states:

| Order state | Triggering code(s) |
|-------------|--------------------|
| `WAITING_WALLET` | `WAITING_WALLET` (no wallet / no trustline, pre-settle) |
| `PAYMENT_FAILED` | `PAYMENT_FAILED` |
| `SETTLEMENT_PENDING` | `SETTLEMENT_PENDING`, `RPC_TIMEOUT` |
| `SETTLEMENT_FAILED` | `SETTLEMENT_FAILED`, `CONTRACT_REVERT`, `INSUFFICIENT_FLOAT` |
| `WITHDRAW_FAILED` | `WITHDRAW_FAILED` (terminal — no documented transition sets `Order.status = WITHDRAW_FAILED`; the `Withdrawal` entity carries its own `FAILED`) |
| `CANCELLED` | (reserved — no MVP trigger path) |

> **Governance flag (verified gap):** `OrderStatus.WITHDRAW_FAILED` and `OrderStatus.CANCELLED` exist in the enum but have **no documented transition trigger** in §20. The withdrawal failure lives on the `Withdrawal` entity, not the Order. BE-012 should either wire a `WITHDRAW_PENDING → WITHDRAW_FAILED` path or document these states as reserved. Recorded in [Final Consistency Report](../reviews/Final-Consistency-Report.md) §4 known issues.

---

## Retry policy (from §20)

Automatic retries apply **only** to:
- Settlement verification (`RPC_TIMEOUT`/`SETTLEMENT_PENDING`)
- Horizon requests (`HORIZON_TIMEOUT`)
- Email delivery (`NOTIFICATION_FAILED`)

**Maximum 3 retries, exponential backoff.** Settlement retries verify (poll `getTransaction`), never re-invoke a successful settle (double-spend risk — the contract `order_ref` guard is the last line of defense).

---

*Cross-reference: HTTP semantics → [API Standards](./API-Standards.md); exception hierarchy → [Coding Standards](../engineering/Coding-Standards.md) (BE-012); failure recovery in the demo → [Failure Recovery](../demo/Failure-Recovery.md).*
