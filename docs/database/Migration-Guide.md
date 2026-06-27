# Migration Guide

> **Status:** How to change the Kreav database schema safely.
> **Authoritative refs:** [Deployment PRD](../backend/Deployment-PRD.md) §7–§8, [Database Bible](./Database-Bible.md).

## Tooling

**Prisma Migrate** is the only migration tool. Never use `prisma db push` in any non-local environment.

## Workflow

1. **Edit** `backend/prisma/schema.prisma`.
2. **Generate + apply locally:** `pnpm prisma migrate dev --name <change>` → creates `prisma/migrations/<timestamp>_<name>/migration.sql` + applies it locally + regenerates the client.
3. **Commit** the migration folder + updated `schema.prisma` in the PR.
4. **CI + deploy apply:** `prisma migrate deploy` (non-interactive) runs in CI (against the Postgres service container) and in the Railway release phase.

> Why generate locally but only *apply* in CI/deploy: the migration SQL is reviewed in the PR; CI/deploy never *generates* (which could drift).

## Rules

- **Forward-only.** Migrations apply in timestamp order. Rollback = a new forward migration that reverses — never `migrate reset` in any environment with data.
- **No destructive migrations without explicit approval.** Dropping a populated table/column is forbidden in MVP. Add the nullable column first; backfill; then (much later) drop in a separate, reviewed migration.
- **Adding a `NOT NULL` column** to a populated table: add it nullable, backfill, then set `NOT NULL` in a follow-up migration. (Avoids a table rewrite lock.)
- **The `@map` casing convention** (model camelCase → DB snake_case) requires **no migration** when renaming a *model field* — only the `@map` target changes, the DB column is untouched. (BE-004 did this.)
- **Enum changes:** adding a value is safe (e.g. a new `RecipientType`). Removing/renaming a value requires a careful migration (Postgres enums are strict).
- **The `SettlementRecipient.createdAt` addition** (ADR H3) is the model: added as a nullable column with a default, backfilled, then made non-null — or added fresh before data exists. When BE-007 starts, run `pnpm prisma migrate dev --name settlement_recipient_created_at` in the branch (the field is already in `schema.prisma`).

## CI/deploy integration

```
release phase (Railway) / CI service container:
  prisma migrate deploy   → applies pending migrations in order, fails fast on drift
```

- CI migrates to validate the migration applies cleanly against a fresh DB (catches drift between schema and migration history).
- Railway runs `migrate deploy` in the release phase so the schema matches the deploying code version.

## Backward compatibility

- A migration must not break the currently-running code. Add columns nullable; deploy code that uses them; only then constrain/drop.
- The DB must tolerate two consecutive code versions during a rolling deploy (see [Deployment PRD §18](../backend/Deployment-PRD.md#18-deployment-strategy)).

## Rollback

- **Code rollback:** redeploy the previous image (Railway retains prior deploys).
- **DB rollback:** a forward-reversal migration. A migration that *dropped* a column cannot be reversed without data loss — which is why destructive migrations are forbidden (§rules).

## Prisma regeneration

- `pnpm prisma generate` runs in the Docker build stage (client baked into the image) and after every `migrate dev`.
- The generated client (`node_modules/.prisma`) is never committed.

---

*Cross-reference: schema conventions → [Database Bible](./Database-Bible.md); deploy/release flow → [Deployment PRD](../backend/Deployment-PRD.md).*
