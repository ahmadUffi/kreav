# Kreav Backend

Settlement orchestration layer for digital product creators, powered by Stellar.
**NestJS + Prisma + PostgreSQL.** Non-custodial: the backend stores only public
wallet addresses — never private keys or seed phrases.

> **Source of truth:** [`../docs/backend/Backend-PRD.md`](../docs/backend/Backend-PRD.md) v3 (Final).
> **Working agreement:** [`./AGENTS.md`](./AGENTS.md).

## Status

BE-001 — project skeleton, config, health endpoint, CI. Subsequent tasks add
Prisma/DB (BE-002), entities (BE-003), and the product/checkout/wallet flows.

## Requirements

- Node 24+
- pnpm 11+
- (BE-002+) Docker, for local PostgreSQL

## Quick start

```bash
pnpm install
cp .env.example .env        # then edit values
pnpm start:dev              # http://localhost:3000
```

## Scripts

| Script            | Purpose                  |
| ----------------- | ------------------------ |
| `pnpm start:dev`  | Run in watch mode        |
| `pnpm build`      | Compile to `dist/`       |
| `pnpm lint`       | ESLint (with auto-fix)   |
| `pnpm lint:check` | ESLint (CI mode, no fix) |
| `pnpm test`       | Unit tests               |
| `pnpm test:e2e`   | End-to-end tests         |
| `pnpm format`     | Prettier write           |

## Project structure (PRD Section 7)

```
src/
├── auth/           # login, register, session (future: SEP-10)
├── users/          # creator profiles
├── products/       # product catalog APIs        (BE-004)
├── orders/         # checkout + payment webhook   (BE-005)
├── wallets/        # connect / balance / withdraw (BE-008, BE-009)
├── stellar/        # internal: Horizon + Soroban  (BE-007)
│   └── dto/
├── prisma/         # PrismaService                (BE-002)
├── common/         # filters, interceptors, dto, health
├── config/         # typed config + Joi validation
├── app.module.ts
└── main.ts
```

## Environment

See `.env.example`. Missing/invalid required vars cause a **fail-fast** boot.
