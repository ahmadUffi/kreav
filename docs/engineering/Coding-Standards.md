# Coding Standards

> **Status:** Canonical engineering conventions for the Kreav backend (NestJS + Prisma + TypeScript). The authoritative workflow rules live in [`AGENTS.md`](../../AGENTS.md); this doc elaborates the *code-level* standards.
> **Authoritative refs:** [Backend PRD](../backend/Backend-PRD.md) §5–§7, [AGENTS.md](../../AGENTS.md), [API Standards](../api/API-Standards.md), [Database Bible](../database/Database-Bible.md).

---

## 1. Folder structure

```
backend/
├── prisma/            schema.prisma + migrations/
├── src/
│   ├── common/        cross-cutting: filters, interceptors, serialization, health
│   ├── config/        typed config + Joi validation
│   ├── prisma/        PrismaService (OnModuleInit/OnModuleDestroy)
│   ├── events/        event bus (names, payloads, log listener)
│   ├── products/      feature module (controller + service + dto)
│   ├── orders/        feature module (checkout + webhook + state machine)
│   ├── wallets/       (BE-008) connect / balance / withdraw
│   ├── stellar/       (BE-007) RPC + Horizon + settlement
│   ├── notifications/ (BE-013) Resend adapter + NotificationLog
│   ├── app.module.ts
│   └── main.ts        bootstrap (helmet, CORS, pipes, interceptors, throttler, rawBody)
└── test/              *.e2e-spec.ts (real DB)
```

- **One feature = one module** (controller + service + dto co-located). No god-modules.
- Unit tests (`*.spec.ts`) live beside the code; e2e (`*.e2e-spec.ts`) in `test/`.

## 2. NestJS architecture

- **Modular monolith** (ADR-003). Each feature module is self-contained, imports `PrismaModule`, and is registered in `AppModule`.
- **Cross-cutting concerns are global** (registered once in `main.ts`/`AppModule`): `Helmet`, CORS, `ValidationPipe`, `DecimalToStringInterceptor`, `ThrottlerGuard` (`APP_GUARD`), `EventEmitterModule`, `ThrottlerModule`.

## 3. Dependency Injection

- Inject via constructor (`constructor(private readonly prisma: PrismaService)`). Use `readonly`.
- `PrismaModule` is the single provider of `PrismaService` (exported, never re-instantiated).
- `EventEmitter2` is provided globally by `EventEmitterModule.forRoot()` — feature modules inject it without a local import.

## 4. DTO rules

- One DTO per request shape, in `dto/`. Fields use `class-validator` decorators.
- **Money fields are decimal strings** with a regex (e.g. `@Matches(/^\d+(\.\d{1,2})?$/)`) — never JS numbers.
- Required fields get `@IsString()`/`@IsUUID()`/`@IsNotEmpty()`; optional get `@IsOptional()`.
- Coerce pagination numerics with `@Type(() => Number)` (class-transformer) + `@IsInt() @Min() @Max()`.
- DTO fields use `!` definite assignment (populated by the transformer) to satisfy `strictPropertyInitialization`.

## 5. Validation rules

- Global `ValidationPipe`: `whitelist`, `transform`, `forbidNonWhitelisted`. This is the mass-assignment guard.
- Validate at the boundary (DTO); services assume valid input.
- Domain invariants (e.g. collaborator percentages sum to 100%) validated in the service.

## 6. Patterns: Repository / Service / Controller

- **Controller** — thin: parse request → call service → return result. No business logic. Rate-limit (`@Throttle`) + HTTP decorators only.
- **Service** — all business logic. Injectable. Calls Prisma / RPC / Horizon / Resend. Emits events via the bus.
- **No separate Repository layer in MVP** — Prisma *is* the repository. (A repository abstraction is over-engineering for a monolith with one DB; revisit if we add a second data source.)
- **Interceptor** (`DecimalToStringInterceptor`) — global, serializes money. Don't `.toString()` money per-endpoint.

## 7. Exception hierarchy (BE-012 — to build)

- Base `DomainException` → maps to HTTP codes via a global exception filter.
- `FinancialException` subclass for money-related failures (settlement, withdrawal).
- Specific exceptions carry a stable `code` from the [Error-Codes catalog](../api/Error-Codes.md) (e.g. `InvalidStateTransitionException` → `INVALID_STATE_TRANSITION`).
- Never `throw new HttpException()` ad-hoc — use the hierarchy so the error catalog is exhaustive.

## 8. Logging rules

- Use NestJS `Logger` (context = class/module name). Structured, to stdout.
- **Always log:** event names, `orderId`, `txHash`, amounts, state transitions, `requestId`.
- **Never log:** secret keys, seed phrases, `PLATFORM_WALLET_SECRET`, `GCASH_WEBHOOK_SECRET`, full tokens, PII at `error` level.
- See [Observability PRD](../backend/Observability-PRD.md) §1–§6.

## 9. Testing conventions

- **Pragmatic TDD** ([AGENTS.md](../../AGENTS.md)): write the behavior test with/before the implementation; never ship a `feat` without its test.
- **Unit** (`*.spec.ts`): pure logic + services with Prisma/RPC/Horizon **mocked** (jest.fn). Fast, deterministic.
- **E2e** (`test/*.e2e-spec.ts`): real Postgres service container. Catches schema/transaction/constraint bugs mocks hide.
- Money tests assert `Decimal` values (e.g. `.toFixed(2) === "10.00"`), not float equality.
- See [Testing PRD](../backend/Testing-PRD.md).

## 10. Naming conventions

- Files: `kebab-case` for NestJS-generated (`products.service.ts`); match the class.
- Classes: `PascalCase` (`ProductsService`, `OrdersController`).
- Variables/functions: `camelCase`.
- Constants: `camelCase` (or `SCREAMING_SNAKE` for true constants like event names).
- Private fields prefixed `_` only when destructured-and-ignored (e.g. `_omitted`).
- DB columns `snake_case`; model fields `camelCase` (see [Database Bible §2](../database/Database-Bible.md#2-naming-conventions)).

## 11. TypeScript style guide

- **`strict` mode** on. No implicit `any`.
- **`no-explicit-any`**: warn today; flip to **error** for financial code (audit #17).
- Prefer `interface` for DTO shapes, `type` for unions.
- Money: `Prisma.Decimal` in services, `string` at the API boundary, never `number`.
- Use `readonly` on injected deps and immutable config.

## 12. Prisma usage

- Inject `PrismaService` (extends `PrismaClient`). Never `new PrismaClient()` outside the service.
- Money writes: `new Prisma.Decimal(stringValue)`.
- Use Prisma's typed `where`/`include` — no raw SQL in MVP.
- Transactions (`$transaction`) for atomic multi-row writes (e.g. Settlement + N SettlementRecipients).

## 13. Async patterns

- `async`/`await` everywhere. No `.then()`/`.catch()` chains.
- The event bus emit is **synchronous** (`EventEmitter2` default) — handlers run before the emitter returns. Settlement is triggered async via the bus listener, but the webhook returns fast.
- Polling loops (RPC `getTransaction`) use `await sleep` + a bounded retry count.

## 14. Transaction boundaries

- A settlement write is **one Prisma `$transaction`**: write `Settlement` + N `SettlementRecipient` + update `Order.status` atomically. If any fails, none persist.
- Never split a money-consistent write across non-transactional calls.

## 15. Security practices (code-level)

- No secrets in code/logs (see [Security PRD](../security/Security-PRD.md)).
- `forbidNonWhitelisted` + `whitelist` on every DTO (mass-assignment protection).
- HMAC verification timing-safe; raw body for webhook.
- Money never as `number`; Decimal everywhere (rounding protection).
- `PLATFORM_WALLET_SECRET` accessible only to `SettlementService`.

## 16. Definition of Done (before opening a PR)

From [AGENTS.md](../../AGENTS.md) — all must be true:
- [ ] `pnpm lint` clean
- [ ] `pnpm build` succeeds
- [ ] `pnpm test` green
- [ ] Every acceptance-criteria checkbox in the issue is ticked
- [ ] No secrets / `.env` committed (only `.env.example`)
- [ ] Money handled as Decimal/string, never float
- [ ] PR body includes `closes #X` + maps changes to the issue's acceptance criteria

## 17. Definition of Ready (an issue is ready to start when)

- [ ] Acceptance criteria are explicit and testable
- [ ] The relevant ADR(s) / PRD sections are referenced
- [ ] Dependencies (prior issues) are merged to `develop`
- [ ] Env vars / schema changes the task needs are identified
- [ ] The agent (or engineer) has read the linked [sequence diagram(s)](../architecture/Sequence-Diagram-Bible.md)

---

*Cross-reference: workflow (branch/commit/merge) → [Branching Strategy](./Branching-Strategy.md); review rigor → [Code Review Checklist](./Code-Review-Checklist.md).*
