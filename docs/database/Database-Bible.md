# Database Bible

> Prinsip dan konvensi schema PostgreSQL Kreav. Schema hidup ada di [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma); dokumen ini menjelaskan *why*-nya.

---

## 1. Philosophy

- **PostgreSQL = application state; Stellar = settlement state.** DB pegang users, products, orders, mirror akuntansi settlement. Balance truth = live Horizon read, bukan DB.
- **Prisma = satu-satunya akses DB.** No raw SQL di MVP.
- **Money = `Decimal`, never `float`.** Setiap kolom moneter `Decimal(18,2)`; persentase `Decimal(5,2)`.

## 2. Naming

| Layer | Style | Contoh |
|-------|-------|--------|
| DB columns | `snake_case` | `price_usd`, `creator_id` |
| Prisma fields | `camelCase` + `@map` | `priceUsd` → `price_usd` |
| Tables | `snake_case` plural via `@@map` | `users`, `products` |
| Enums | `SCREAMING_SNAKE_CASE` | `PAYMENT_RECEIVED` |

## 3. 9 Models — Ringkasan

| Domain | Model | Purpose |
|--------|-------|---------|
| 👤 User | `User` | Creators + buyers |
| 🛒 Commerce | `Product` | Digital product + price |
| | `ProductCollaborator` | Multi-creator split shares |
| | `Order` | Purchase; 13-state machine |
| | `Settlement` | 1 canonical on-chain event |
| | `SettlementRecipient` | N accounting breakdown rows |
| 💰 Wallet | `Wallet` | Connected wallet (**public key only**) |
| | `Withdrawal` | Off-ramp record (mock anchor) |
| 📧 Infra | `NotificationLog` | Durable retry state |

Detail field + constraint → lihat [`schema.prisma`](../../backend/prisma/schema.prisma) dan [ERD](./ERD.md).
