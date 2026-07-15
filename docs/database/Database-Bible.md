# Database Bible

> Principles and conventions for Kreav's PostgreSQL schema. The live schema is located in [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma); this document explains the architectural rationale.

---

## 1. Philosophy

- **PostgreSQL = application state; Stellar = settlement state.** The database holds users, products, orders, and settlement accounting mirrors. Balance truth is always derived from live Horizon reads, never stored in the DB.
- **Prisma = sole database access layer.** No raw SQL is used in the MVP.
- **Money = `Decimal`, never `float`.** Every monetary column uses `Decimal(18,2)`; percentages use `Decimal(5,2)`.

## 2. Naming

| Layer | Style | Example |
|---|---|---|
| DB columns | `snake_case` | `price_usd`, `creator_id` |
| Prisma fields | `camelCase` + `@map` | `priceUsd` → `price_usd` |
| Tables | `snake_case` plural via `@@map` | `users`, `products` |
| Enums | `SCREAMING_SNAKE_CASE` | `PAYMENT_RECEIVED` |

## 3. Summary of 9 Models

| Domain | Model | Purpose |
|---|---|---|
| 👤 User | `User` | Creators + buyers |
| 🛒 Commerce | `Product` | Digital product + price |
| | `ProductCollaborator` | Multi-creator split shares |
| | `Order` | Purchase; 13-state machine |
| | `Settlement` | 1 canonical on-chain event |
| | `SettlementRecipient` | N accounting breakdown rows |
| 💰 Wallet | `Wallet` | Connected wallet (**public key only**) |
| | `Withdrawal` | Off-ramp record (mock anchor) |
| 📧 Infra | `NotificationLog` | Durable retry state |

For complete field definitions and constraints, refer to [`schema.prisma`](../../backend/prisma/schema.prisma) and the [ERD](./ERD.md).

