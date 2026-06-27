# API Standards

> **Status:** Canonical REST conventions for the Kreav backend. Every endpoint must conform.
> **Authoritative refs:** [Backend PRD](../backend/Backend-PRD.md) §9 (API Specification), [Coding Standards](../engineering/Coding-Standards.md).
> **Inconsistency resolved here:** the webhook path. The corpus was split between `/webhooks/payment` (Backend PRD §6/§9) and `/webhooks/gcash` (AGENTS.md, Security-Audit #11, BE-005 implementation). Per the authority hierarchy (Backend PRD wins), the **canonical path is `POST /webhooks/gcash`** — the BE-005 implementation + Security-Audit + AGENTS.md reflect the shipped reality; a follow-up PRD §9 edit is recorded in [Final Consistency Report](../reviews/Final-Consistency-Report.md).

---

## 1. REST conventions

- **JSON in / JSON out.** `Content-Type: application/json`. No XML, no form-encoded bodies for API routes (webhooks verify HMAC over the **raw body**, see §11).
- **Resource-oriented paths**, lowercase, hyphenated, plural nouns: `/products`, `/products/:id`, `/wallet/balance`. Nested under a domain prefix where natural (`/wallet/...`).
- **HTTP methods** map to intent: `GET` (read, never side-effects), `POST` (create/trigger), `PATCH`/`PUT` (none in MVP). No `DELETE` in MVP.
- **Idempotency where it matters:** payment/withdrawal triggers use an idempotency key (see §12).
- **No trailing slashes.** No `.json` suffixes.

## 2. Naming

- Paths: `kebab-case` for multi-word segments; `:camelCase` is forbidden in paths.
- JSON fields: **`camelCase`** (e.g. `orderId`, `priceUsd`, `walletAddress`, `createdAt`). This matches the Prisma model fields (post-BE-004 camelCase refactor).
- Booleans: `true`/`false` (no `0`/`1`, no `"yes"`).
- Enums (string): `SCREAMING_SNAKE_CASE` for values (e.g. `OrderStatus` values, `recipientType: "CREATOR"`).

## 3. HTTP status rules

| Status | Meaning | Kreav usage |
|--------|---------|-------------|
| `200 OK` | Successful read / idempotent ack | `GET`, idempotent webhook acks |
| `201 Created` | Resource created | `POST /products`, `POST /checkout` |
| `204 No Content` | Success, no body | (reserved; none in MVP yet) |
| `400 Bad Request` | Validation / invalid state transition | DTO validation, malformed money, illegal Order transition |
| `401 Unauthorized` | Auth/signature failure | webhook HMAC invalid |
| `404 Not Found` | Resource missing | unknown product/order |
| `429 Too Many Requests` | Rate limited | throttler (checkout/webhook limits) |
| `500 Internal Server Error` | Unexpected | unhandled exceptions |
| `502`/`503`/`504` | Upstream (RPC/Horizon/Resend) failure | propagation of Stellar/Resend errors |

- Never return `200` with an error body. Errors use `4xx`/`5xx` (see [Error-Codes](./Error-Codes.md)).
- Success bodies are the resource (or `{ data, ...meta }` for lists — see §8).

## 4. Validation

- **Global `ValidationPipe`**: `whitelist: true` (strip unknown), `transform: true` (coerce), `forbidNonWhitelisted: true` (reject unknown → 400). This is mass-assignment protection.
- DTOs carry `class-validator` decorators. Money fields are **decimal strings** with a regex (e.g. `priceUsd`: `/^\d+(\.\d{1,2})?$/`), never JS numbers.
- UUIDs validated with `@IsUUID()`. Pagination params coerced via `@Type(() => Number)` + bounded (`limit ≤ 100`).
- Money is accepted and returned as a **string** (e.g. `"10.00"`) — see §10.

## 5. Response format

### Single resource
```json
{ "id": "p1", "title": "AI Interview Playbook", "priceUsd": "10.00", "creator": { "id": "u1", "name": "Ayu" } }
```

### List (paginated)
```json
{
  "data": [ { "id": "p1", ... }, { "id": "p2", ... } ],
  "page": 1,
  "limit": 20,
  "total": 42
}
```

### Money fields are always strings (global `DecimalToStringInterceptor` serializes `Prisma.Decimal` → `"10.00"`). Never `{d:[...]}`, never a raw JS number.

## 6. Pagination

- Query params: `page` (1-based, default 1), `limit` (default 20, max 100).
- Response meta: `page`, `limit`, `total`.
- Implementation: Prisma `skip: (page-1)*limit`, `take: limit` + a parallel `count`.

## 7. Filtering & sorting

- **Filtering** via query params scoped to the resource, e.g. `GET /products?creatorId=<uuid>`.
- **Sorting** is not a generic MVP feature; list endpoints default to a sensible order (e.g. products newest-first by `createdAt desc`). Generic `?sort=` is a future enhancement.

## 8. Money serialization (critical)

- **On-chain:** USDC uses **7 decimals** (base units) — see [Stellar Standards PRD](../stellar/Stellar-Standards-PRD.md) ED-7. The backend scales between DB `Decimal(18,2)` and on-chain base units (`amount_base = amount_usd × 10^7`).
- **API + DB:** money is a **2-decimal decimal string** (`"10.00"`). Accept as a string; store as `Prisma.Decimal`; return via the global interceptor as a string.
- Never accept money as a JS number (precision loss past 2^53). Never return it as a JS number or as Prisma's internal `{d,e,s}`.

## 9. Date format

- All timestamps are **ISO 8601 UTC** strings (e.g. `"2026-06-24T12:41:36.000Z"`).
- Stored as `DateTime` (Prisma); serialized as ISO strings in responses.

## 10. Authentication strategy

- **MVP: placeholder.** Buyers are anonymous (tracked by `orderId` + `buyerEmail`). Creators authenticate by wallet connection (public-key match) — no challenge-response in MVP.
- **Post-MVP:** SEP-10 wallet auth → JWT session (see [Security PRD](../security/Security-PRD.md) §5–§6). Do not invent an ad-hoc JWT scheme before SEP-10.
- No API keys, no Basic auth. The webhook uses an HMAC secret (§11), not bearer auth.

## 11. Webhook rules

- **Path:** `POST /webhooks/gcash` (canonical — see header note on the resolved inconsistency).
- **Signature:** HMAC-SHA256 over the **raw request body**, transmitted in the `X-Gcash-Signature` header, verified **timing-safe** before the body is trusted ([Security PRD §7](../security/Security-PRD.md)).
- **Raw body:** NestJS `rawBody: true` exposes `req.rawBody` so the HMAC is over the exact bytes.
- **Dev escape hatch:** if `GCASH_WEBHOOK_SECRET` is unset, the signature is accepted but a warning is logged. **On-stage demo MUST set the secret.**
- **Idempotency:** the `paymentRef` (Payment Transaction ID) is the idempotency key — a duplicate webhook is acked (200) but does nothing (no re-emit, no re-settle).
- **Response:** always `200 { status: "paid", orderId }` for valid+idempotent acks, even when the order defers to `WAITING_WALLET`. The heavy work (settlement) runs async via the event bus.

## 12. Idempotency

- **Webhook:** `paymentRef` (§11) — one payment maps to exactly one order/settlement (DB UNIQUE on `Order.paymentRef`, audit #5).
- **Contract:** the `settle` contract's `order_ref` (= `Order.id`, ADR H2) rejects a duplicate invocation.
- **Withdrawal:** an idempotency key (withdrawal intent id) prevents duplicate withdrawal creation.
- Defense in depth: backend check → DB constraint → contract guard.

## 13. Versioning & backward compatibility

See [Versioning](./Versioning.md). MVP is unversioned (single consumer). Strategy for evolution: URI versioning (`/v2/...`) when a breaking change is unavoidable; additive (non-breaking) changes need no version bump.

## 14. Endpoint catalog

Consistent documentation of every endpoint. Shapes are authoritative in [Backend PRD §9](../backend/Backend-PRD.md#9-api-specification); this is the canonical path/method summary:

| Method | Path | Purpose | Idempotency | Rate limit |
|--------|------|---------|-------------|------------|
| `GET` | `/health` | Liveness | — | global default |
| `GET` | `/products` | Paginated list (optional `?creatorId=`) | read | global default |
| `GET` | `/products/:id` | Product detail + creator | read | global default |
| `POST` | `/products` | Create product | — | global default |
| `POST` | `/checkout` | Create order (`PAYMENT_PENDING`) | — | 20/min |
| `POST` | `/webhooks/gcash` | Confirm GCash payment | `paymentRef` | 10/min |
| `POST` | `/wallet/connect` | Connect wallet (public key) | — | global default |
| `GET` | `/wallet/balance` | USDC balance (live Horizon) | read | global default |
| `GET` | `/wallet/transactions` | Settlement + withdrawal history | read | global default |
| `POST` | `/wallet/withdraw` | Start withdrawal (mock anchor) | withdrawal intent id | (throttled on impl) |

> Notes: `GET /wallet` (singular) appears in Backend PRD §6 but is superseded by the explicit `/wallet/balance` + `/wallet/transactions` in §9. Future endpoints (collaborators, explorer link) follow the same conventions.

---

*Cross-reference: error bodies → [Error-Codes](./Error-Codes.md); DTO/validation rules → [Coding Standards](../engineering/Coding-Standards.md); security of each endpoint → [Security PRD](../security/Security-PRD.md).*
