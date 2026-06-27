# Database Bible

> **Status:** Canonical reference for the Kreav PostgreSQL schema (via Prisma). The living source is [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma); this doc explains the *why* behind each convention.
> **Authoritative refs:** [Backend PRD](../backend/Backend-PRD.md) §8, §20 (Domain Model), [ADR-006](../adr/ADR-006-Why-SettlementRecipient.md), [ADR-007](../adr/ADR-007-Why-PostgreSQL-vs-Blockchain.md).

---

## 1. Philosophy

- **PostgreSQL = application state; Stellar = settlement state** (ADR-007). The DB holds users, products, orders, and the *accounting mirror* of settlements; it never holds authoritative wallet balances (balance truth = live Horizon read).
- **Prisma is the only DB access path.** No raw SQL in MVP. Parameterized queries prevent injection (OWASP API8).
- **Money is `Decimal`, never `float`.** Every monetary column is `Decimal(18,2)`; percentages are `Decimal(5,2)`.

## 2. Naming conventions

- **DB columns:** `snake_case` (e.g. `price_usd`, `creator_id`, `created_at`).
- **Prisma model fields:** `camelCase` (e.g. `priceUsd`, `creatorId`, `createdAt`), each with `@map("snake_case")` pointing at the column. This means the Prisma client + API return camelCase JSON, while the DB stays snake_case — **with no migration needed** (the `@map` targets are unchanged; BE-004 refactor).
- **Tables:** `snake_case` plural via `@@map("users")`, `@@map("products")`, etc.
- **Enums:** `SCREAMING_SNAKE_CASE` values; enum type names `PascalCase` (`OrderStatus`, `RecipientType`).

## 3. Entities & relationships

See the [ERD](./ERD.md) for the full diagram. Summary of the 9 models + 9 enums (verified against the live schema):

| Domain | Model | Purpose |
|--------|-------|---------|
| User | `User` | Creators + buyers (buyers anonymous in MVP) |
| Commerce | `Product` | Digital product + price |
| Commerce | `ProductCollaborator` | Multi-collaborator split shares (v3.1 §19) |
| Commerce | `Order` | A purchase; 13-state machine |
| Commerce | `Settlement` | 1 canonical on-chain settlement event |
| Commerce | `SettlementRecipient` | N accounting breakdown rows |
| Wallet | `Wallet` | Creator's connected wallet (**public key only**) |
| Wallet | `Withdrawal` | Off-ramp record (mock anchor in MVP) |
| Infra | `NotificationLog` | Durable notification retry state |

## 4. Primary keys

- All PKs are `String @id @default(uuid())` — UUID v4. No auto-increment integers (avoids enumeration + leaky counts; globally unique for future sharding).
- `Order.id` doubles as the contract's `order_ref` (ADR H2).

## 5. Foreign keys

- Financial relations use `referentialAction: Restrict` (default) — e.g. cannot delete a `User` who has `Products`/`Wallets`/`Withdrawals` while data exists. This protects referential integrity of money/accounting records.
- Metadata/cascade relations use `onDelete: Cascade` — e.g. `ProductCollaborator` and `SettlementRecipient` cascade when their parent (`Product`/`Settlement`) is deleted (children are meaningless without the parent).

## 6. Indexes (declared in schema)

| Model | Index | Purpose |
|-------|-------|---------|
| `Product` | `@@index([creatorId])` | List products by creator |
| `ProductCollaborator` | `@@index([productId, status])` | Fetch active collaborators per product |
| `Order` | `@@index([status])` | Recovery job: find stuck orders by state |
| `Settlement` | `@@index([status])` | Settlement monitoring |
| `SettlementRecipient` | `@@index([settlementId])` | Fetch a settlement's breakdown |
| `Wallet` | `@@index([creatorId])` | Lookup wallet per creator |
| `Withdrawal` | `@@index([creatorId, createdAt])` | Withdrawal history per creator |
| `NotificationLog` | `@@index([status, event])` | Retry cron: find FAILED/pending logs |

## 7. Unique constraints

| Model | Constraint | Purpose |
|-------|-----------|---------|
| `User` | `email @unique` | One account per email |
| `Order` | `@@unique([paymentRef])` | Idempotency: one payment → one order (audit #5) |
| `Settlement` | `orderId @unique` (inline) | 1:1 Order ↔ Settlement |

## 8. Money storage & precision

| Column type | Used for | Why |
|-------------|----------|-----|
| `Decimal(18,2)` | `amountUsd`, `priceUsd`, settlement amounts | 2-decimal USD; large scale (18 digits) |
| `Decimal(5,2)` | `percentage`, `revenuePercentage` | Percent 0.00–100.00 |

- **Never `Float`/`Double`** for money (rounding). Prisma returns `Prisma.Decimal`; the global `DecimalToStringInterceptor` serializes to `"10.00"` ([API Standards §8](../api/API-Standards.md#8-money-serialization-critical)).
- On-chain USDC uses **7 decimals** (base units); conversion is at the integration seam, not in storage.

## 9. Soft delete policy

**No soft deletes in MVP.** Deletions are hard `DELETE` (or cascade). Rationale: MVP volume is trivial; soft-delete adds query complexity (`WHERE deleted_at IS NULL`) without demo value. Settlement/accounting rows are **never deleted** (Restrict FKs + business rule — they're immutable history).

## 10. Audit columns

- `createdAt DateTime @default(now())` on every model — **including `SettlementRecipient`** (ADR H3 / audit #9, now fixed).
- `updatedAt DateTime @updatedAt` only on `NotificationLog` (it's the lone entity that mutates through retry states).
- Settlements/recipients are **append-only** (created once, never updated except status transitions on Settlement).

## 11. Prisma conventions

- `generator client { provider = "prisma-client-js" }`; `datasource db { provider = "postgresql"; url = env("DATABASE_URL") }`.
- `PrismaService extends PrismaClient` with `OnModuleInit` (`$connect`) + `OnModuleDestroy` (`$disconnect`) for graceful shutdown (audit #2).
- `emit: 'stdout'` (NOT `'event'` — audit #3 fixed a memory leak).
- Money is written as `new Prisma.Decimal(stringValue)` to avoid float contamination.

## 12. Constraints as security

- `@@unique([paymentRef])` enforces idempotency at the row level — a duplicate payment cannot bind to a second order.
- FK `Restrict` prevents orphaned money records.
- Enum types constrain state to valid values (can't set `Order.status = "PAID"` — it's not a valid `OrderStatus`).

## 13. Future scaling considerations

- **Volume:** MVP is trivial; the schema scales to millions of rows with the existing indexes.
- **Read replicas:** the balance read goes to Horizon, not the DB — so DB read load is low.
- **Partitioning:** `Order`/`Settlement` could partition by `createdAt` at very high volume (future).
- **Sharding:** UUID PKs make future sharding possible without key migration.

---

*Cross-reference: full entity diagram → [ERD](./ERD.md); how to change the schema → [Migration Guide](./Migration-Guide.md).*
