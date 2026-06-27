# Kreav Final Architecture Review

> **Status:** Final Architecture Design Review (ADR) — the engineering gate before implementation.
> **Role:** Principal Software / Blockchain / Security Architect.
> **Authority:** Official Stellar Skills (skills.stellar.org) > Architecture Consistency Check > Kreav Backend PRD v3.1 > all other docs.
> **Basis:** Complete Stellar Skills corpus (7 skills) + all 16 engineering documents + AGENTS.md + the actual `KREAV-app/backend/prisma/schema.prisma` and `src/` code (verified verbatim during review).
> **Date:** 2026-06-24.

---

# Executive Summary

Kreav's architecture is **technically sound and internally consistent** on its load-bearing decisions: non-custodial wallets, a single Soroban revenue-split contract, USDC (classic) via the SAC, RPC-primary/Horizon-secondary, a 13-state order machine, idempotent webhooks, and an honest mock/real boundary (real settlement, mocked fiat rails). These align with the official Stellar Skills. The documentation quality is high — the corpus is enterprise-grade in depth and cross-referencing.

**Two Critical findings and three High findings** were identified during review — all are **documentation/ops gaps, not design defects**, and all are resolved by the approved revisions applied immediately after this review (see §Critical Issues and the companion `docs/reviews/Final-Consistency-Report.md`). No load-bearing decision requires redesign.

The single most important finding (**C1**) is the **platform-account USDC funding gap**: the `settle` contract transfers *real* testnet USDC out of the platform account, but the buyer pays via *mock* GCash that mints no USDC. Nothing documented how the platform account obtains its USDC float. This is a silent demo-killer (the account depletes after ~N settlements, then every `settle` reverts). Resolved by documenting the pre-funded float model and adding a backlog task (BC-011) to pre-fund.

**Architecture maturity: high.** The corpus spans product scope, backend, demo, architecture, backlog, security audit, 3 Stellar PRDs, 6 engineering Bibles, and 3 consistency/review documents — every "WHY" answered, every deferral documented with a trigger. Implementation (BE-007 onward) can begin once the revisions land.

**Final verdict: ⚠ Needs Revision → ✅ Approved for Implementation** (the revisions are documentation-only and are applied in Step 2 of this exercise).

---

# Architecture Score

| Area | Score | Justification |
|------|------:|---------------|
| **Product** | 90 | Clear scope, strong non-goals, honest mock/real boundary. −10: the funding-float model (C1) was an unstated assumption. |
| **Backend** | 88 | Clean modular monolith, DI/lifecycle sound, global guards + interceptor well-placed. −12: settlement layer is still a stub (M1); missing `PLATFORM_WALLET_SECRET` (H1). |
| **Database** | 85 → 90* | Good DDD split (1 Settlement + N Recipients), proper money decimals, FK constraints. −15: `SettlementRecipient` lacks `createdAt` (H3); no `order_ref` field (H2 — resolved by mapping). *Post-fix. |
| **API** | 90 | RESTful, consistent naming, `whitelist`/`forbidNonWhitelisted`, idempotency, rate limits. −10: only the public platform address is documented; the signing secret (H1) was absent. |
| **Wallet** | 95 | Non-custodial correctly implemented and resolved; public-key-only storage *verified against schema*; Freighter/Lobstr; trustline-aware. −5: SEP-10 deferred (acceptable). |
| **Stellar** | 92 | RPC-primary, SAC/USDC, 7-decimal scaling, `op_no_trust` handling, trustline checks — all skills-aligned. −8: funding-float gap (C1); platform secret undocumented (H1). |
| **Soroban** | 88 | Contract spec is sound: `require_auth`, SAC allowlist, checked arithmetic, typed keys, atomicity, `order_ref` idempotency. −12: contract is architecture-only (not built); `order_ref` mapping was undocumented (H2). |
| **Anchor** | 90 | Honest MVP boundary (mock on/off-ramp, SEP-24 shape); clear future SEP-6/SEP-10/SEP-12/SEP-38 roadmap with KYC gate. −10: now that conflicting drafts (C2) are removed, this is clean. |
| **Security** | 89 | Threat model, trust boundaries, HMAC, replay protection, OWASP mapping, platform-key isolation. −11: platform secret undocumented (H1); float-depletion risk unmonitored (C1). |
| **Deployment** | 88 | MVP-right-sized (Railway + managed PG, no premature K8s); graceful shutdown; image-rollback; migration strategy. −12: missing `PLATFORM_WALLET_SECRET` in env table (H1); float top-up undocumented (C1). |
| **Testing** | 92 | Pragmatic TDD, real-DB e2e, mock seams, demo checklist, coverage targets, regression-for-each-audit. −8: RPC/contract tests are mock-based (correct for CI, but real Testnet smoke is manual). |
| **Observability** | 88 | Structured logs, correlation IDs, event trail, audit-as-domain-tables, incident flow. −12: no float-balance signal (C1); OTel/Prometheus deferred (acceptable). |
| **Documentation** | 93 | Enterprise-grade depth, cross-referenced, every decision has rationale+tradeoff. −7: funding model (C1) + `order_ref` mapping (H2) were implicit. |
| **Maintainability** | 92 | Consistent terminology, modular boundaries, typed money, typed event payloads. −8: schema audit timestamp gap (H3). |
| **Scalability** | 85 | MVP single-instance is right-sized; documented horizontal-scale caveats (bus/throttler/cron need Redis at N>1). −15: those caveats mean real scaling requires real work post-MVP (honest, not a defect). |
| **Overall** | **89 → 93\*** | Strong, skills-aligned, honest MVP. The 11-point gap was entirely documentation/ops (C1/C2/H1/H2/H3) — resolved by revisions. *Post-revision score. |

---

# Critical Issues

> Priorities: 🔴 Critical (blocks correctness/demo) · 🟠 High (blocks implementation) · 🟡 Medium · 🟢 Low. All C1–C2, H1–H3 are **resolved** by the revisions in Step 2.

## 🔴 C1 — Platform-account USDC funding gap
- **Problem:** The Soroban `settle` contract transfers REAL testnet USDC *from* the platform account (`source`) to creators (95%) + platform (5%). But the buyer pays via MOCK GCash that mints no USDC. No document explained how the platform account obtains its USDC float. *Verified across Backend PRD §10/§15, Soroban Contract PRD §3/§9, Stellar Standards §2, Anchor PRD §0, Backlog BC-001/002/003, Sequence Bible §10 — none state the funding mechanism.*
- **Impact:** Silent demo-killer. Each settlement draws down the float (~−10 USDC/sale). After ~N sales the account hits zero; every subsequent `settle` reverts ("insufficient source balance", Soroban PRD §9) → `SETTLEMENT_FAILED` with no obvious root cause. This also creates a mental-model tension: docs say the platform key "moves the *buyer's* purchase funds" but in MVP there are no buyer funds.
- **Recommendation:** Document the **pre-funded float model**: the platform account is pre-funded with testnet USDC by the team out-of-band; each settlement draws it down; top up before depletion. Add backlog task **BC-011** (acquire testnet USDC via Circle faucet + pre-fund + top-up procedure). Add a low-float monitor.
- **Reason:** It is consistent with every canonical doc (the team provisions the account; the buyer side is mocked) — it was simply never *stated*. Documenting it removes the ambiguity without changing the design.
- **Affected documents:** Stellar Standards PRD §2/ED table, Backend PRD §10/§15, Soroban Contract PRD §0, Implementation Backlog (BC-011), Sequence Diagram Bible §10/§30, Deployment PRD §4/§9, Observability PRD §9/§10.

## 🔴 C2 — Conflicting `jawaban-prompt-*.md` drafts
- **Problem:** Five undocumented files (`jawaban-prompt-1..5.md`) conflict with the canonical corpus on load-bearing points: a *real* SEP-6/SEP-38 on-ramp that mints USDC (jawaban-3/4/5), "Treasury" naming (jawaban-1/3/4/5 — the very artifact removed from Final Architecture), invented `/auth/challenge`+`/auth/verify` APIs (jawaban-2), and contract fn `split_revenue` vs canonical `settle` (jawaban-1). They are not referenced by any canonical doc or AGENTS.md.
- **Impact:** A future engineer or AI agent reading them would reintroduce exactly the contradictions the consistency checks eliminated (real on-ramp, Treasury node, dual contract names). Footgun.
- **Recommendation:** **Delete the 5 files.** They are superseded drafts; the canonical corpus is internally consistent and skills-grounded. *(User-approved.)*
- **Reason:** Keeping them requires reconciling 4+ conflicts; they have no canonical standing and their only surviving value (non-custodial + RPC-primary reasoning) is already in the canonical docs.
- **Affected documents:** (deletions) `jawaban-prompt-1.md`, `jawaban-prompt-2.md`, `jawaban-prompt-3.md`, `jawaban-prompt-4.md`, `jawaban-prompt-5.md`.

## 🟠 H1 — Missing `PLATFORM_WALLET_SECRET` env var
- **Problem:** Only the public `PLATFORM_WALLET_ADDRESS` is documented (Backend PRD §15, Stellar Standards ED-2). The SettlementService (BE-007) must sign transactions with the platform *secret key*. That secret is nowhere in the env-var lists, secrets-management, or deployment docs.
- **Impact:** Implementation blocker — BE-007 cannot be built without the signing key, and its security handling is undefined.
- **Recommendation:** Add `PLATFORM_WALLET_SECRET` to the env-var lists (Backend PRD §15, Deployment PRD §4, Security PRD §16) and document it as the sole server-side secret, env-driven, rotatable, SettlementService-only.
- **Reason:** It already exists implicitly (the key is the settlement signer); it must be explicit so it's provisioned and protected.
- **Affected documents:** Backend PRD §15, Stellar Standards ED table, Deployment PRD §4/§9, Security PRD §16/§27.

## 🟠 H2 — Contract `order_ref` mapping undocumented
- **Problem:** The `settle` contract takes an `order_ref` for idempotency (Soroban Contract PRD §9). No document maps it to a DB field. *Verified against schema: no `order_ref` column exists; `Order.id` (UUID) is the only candidate.*
- **Impact:** Ambiguity at the integration seam — the BC team and BE team could disagree on what value flows as `order_ref`, risking duplicate or mismatched settlements.
- **Recommendation:** Document that **contract `order_ref` = `Order.id` (the UUID)**. Add a doc-comment to `Order.id` in the schema and a note in Soroban Contract PRD §3/§9.
- **Reason:** Makes the backend↔contract contract explicit and the idempotency guarantee traceable.
- **Affected documents:** Soroban Contract PRD §3/§9, `schema.prisma` (Order doc-comment).

## 🟠 H3 — `SettlementRecipient` missing `createdAt`
- **Problem:** `SettlementRecipient` has no timestamp (audit #9, *verified against the live `schema.prisma` — every other money/lifecycle model has `createdAt`; this is the lone exception).
- **Impact:** Cannot audit the chronological order of recipients within a settlement (relevant for reconciliation and dispute forensics).
- **Recommendation:** Add `createdAt DateTime @default(now()) @map("created_at")` to `SettlementRecipient`. Migration generated when BE-007 starts (not pre-generated here, to keep migration history clean).
- **Reason:** Consistency + auditability; trivial pre-implementation change.
- **Affected documents:** `schema.prisma`, Backend PRD §8/§20 (model docs).

## 🟡 M1 — Settlement layer is a stub (expected)
- **Problem:** `src/stellar/stellar.module.ts` is an empty stub; no `settlement.service.ts`. `payment.received` is currently emitted only to a log listener.
- **Impact:** None *now* — BE-007 is the next sprint. Noted so reviewers know the end-to-end flow is unwired until then.
- **Recommendation:** None (expected state). Ensure BE-007 consumes `payment.received` and emits `settlement.completed`.
- **Affected documents:** none (implementation status).

## 🟡 M2 — `RecipientType.TREASURY` enum risks re-introducing the Treasury node
- **Problem:** The enum still has `TREASURY`/`AFFILIATE`. After removing the Treasury diagram node, a future author might think a Treasury recipient is MVP.
- **Impact:** Low; cosmetic risk of confusion.
- **Recommendation:** Clarify the enum doc-comment: MVP uses only `CREATOR` + `PLATFORM`; `AFFILIATE`/`TREASURY` are future-only.
- **Affected documents:** `schema.prisma`.

## 🟢 Low / notes
- Smart Account Kit / passkeys / streaming payments / staking appropriately scoped Future — no change.
- Redis / Prometheus / OTel / K8s appropriately deferred with documented triggers — no change.
- js-yaml residual CVE accepted (dev-only) — no change.

---

# Inconsistencies

| # | Type | Finding | Status |
|---|------|---------|--------|
| I1 | Wallet model | Product Scope vs Backend PRD custodial conflict | ✅ already resolved (Non-Custodial) |
| I2 | Diagram | Final Architecture `Treasury` node vs MVP (Creator+Platform) | ✅ already resolved (node removed) |
| I3 | Backlog | Backlog stopped at BE-012 vs tracker's BE-013/014 | ✅ already resolved (BE-013/014 added) |
| I4 | API | Demo PRD `/storefront/:slug` vs shipped `/products/:id` | ✅ already resolved (endpoint aligned) |
| I5 | Drafts | `jawaban-prompt-*` real-on-ramp/Treasury/`split_revenue`/`/auth/*` vs canonical | ✅ resolved by C2 deletion |
| I6 | Terminology | "Treasury account" vs "platform account" (in drafts) | ✅ resolved by C2 deletion |
| I7 | Funding model | "moves the buyer's funds" (PRD §10) vs mocked buyer payment (no USDC) | ✅ resolved by C1 (pre-funded float docs) |
| I8 | Env vars | Missing `PLATFORM_WALLET_SECRET` | ✅ resolved by H1 |
| I9 | Contract param | `order_ref` unmapped | ✅ resolved by H2 |
| I10 | Schema | `SettlementRecipient` no `createdAt` | ✅ resolved by H3 |

**No unresolved inconsistencies remain after the revisions.** Terminology, state names, entities, APIs, flows, diagrams, wallet model, settlement model, and env vars are uniform across the corpus.

---

# Over Engineering

The corpus is **right-sized for the MVP** — a notable strength, not a weakness. Items reviewed and kept appropriately deferred:

| Item | Verdict |
|------|---------|
| Custom Soroban token / NFT / streaming / staking contracts | ✅ Future-only (Soroban PRD §15) |
| Redis (bus/throttler/cron-lock) | ✅ Deferred to horizontal-scale trigger |
| Prometheus / Grafana / OpenTelemetry | ✅ Deferred to reliability-SLO trigger |
| Kubernetes | ✅ Deferred; Railway single-instance is right-size |
| Blue/green + canary deploy | ✅ Discussed, deferred |
| Real anchor / SEP-6 / SEP-38 / SEP-12 KYC | ✅ Deferred (mock in MVP) |
| SEP-10 JWT sessions | ✅ Post-MVP |
| Formal contract verification (Certora/Scout) | ✅ Pre-production, not MVP |

**No over-engineering present in the MVP scope.** The architecture is deliberately minimal: one contract, in-process bus, DB-backed retries, single instance.

---

# Missing Architecture

| Missing item | Severity | Why | Resolution |
|--------------|----------|-----|------------|
| Platform USDC funding model | 🔴 C1 | Demo cannot run without a funded float | Documented (pre-funded float + BC-011) |
| `PLATFORM_WALLET_SECRET` | 🟠 H1 | BE-007 signing needs it | Added to env lists |
| `order_ref` mapping | 🟠 H2 | Backend↔contract seam ambiguous | Documented (= `Order.id`) |
| `SettlementRecipient.createdAt` | 🟠 H3 | Audit gap | Added to schema |
| Float-balance monitoring | 🟡 | Ties to C1 | Added to Observability |
| OpenAPI reference | 🟢 | Nice-to-have, not MVP | Noted as post-MVP |
| Frontend PRD | 🟢 | FE team owns; out of agent scope | Noted |

Everything else is **intentional, documented deferral** — not missing.

---

# Stellar Best Practice Review

Each decision checked against skills.stellar.org:

| Decision | vs Skills | Note |
|----------|-----------|------|
| RPC primary, Horizon secondary | ✅ Correct | `data` skill mandates RPC for new/Soroban code |
| USDC classic via SAC (not custom token) | ✅ Correct | `assets` skill: prefer classic unless custom logic needed |
| 7-decimal USDC scaling | ✅ Correct | `agentic-payments` skill canonical constant |
| Trustline required before receive | ✅ Correct | `assets` skill: missing trustline → `op_no_trust` |
| `simulateTransaction` → `assembleTransaction` → submit | ✅ Correct | `data`/`dapp` skill canonical pattern |
| Poll `getTransaction` until non-NOT_FOUND | ✅ Correct | `data` skill |
| Non-custodial wallet (public key only) | ✅ Correct | `dapp`/`standards` skill wallet model |
| SEP-41 via SAC for transfers | ✅ Correct | `standards`/`assets` skill |
| `require_auth` on contract fns | ✅ Correct | `soroban` Part 3 checklist |
| Checked arithmetic + typed storage keys | ✅ Correct | `soroban` Part 3 #4/#5 |
| Atomic settlement (all-or-nothing) | ✅ Correct | Soroban tx atomicity |
| SEP-10 deferred (public-key match in MVP) | ✅ Acceptable | `standards` skill; documented trigger |
| Mocked SEP-24 anchor | ✅ Acceptable | Honest MVP boundary |
| RPC 7-day window caveat | ✅ Documented | `data` skill; verification runs immediately |
| Order-stuck recovery on startup | ✅ Correct | In-process bus loses events on crash (audit #18) |

**Nothing outdated or wrong.** Every Stellar mechanic matches the skills. The only gaps (funding float, secret env var) are *Kreav* gaps, not Stellar-mechanic errors.

---

# Security Review

**Strong.** The threat model is explicit; trust boundaries are drawn; the non-custodial model removes the highest-value attack target (no creator keys held). HMAC webhook verification, replay protection via `paymentRef` + contract `order_ref`, rate limiting, input validation (`forbidNonWhitelisted`), and the OWASP API Top 10 mapping are all in place.

**Resolved this review:** the platform wallet **secret key** is now explicitly documented as the sole server-side secret (H1), and the float-depletion risk is now a monitored signal (C1).

**Residual (acceptable):**
- Testnet reliability is a demo risk (audit #20) — mitigated by pre-demo smoke + txHash backup.
- SEP-10 absent in MVP — acceptable, public-key match suffices for the demo.
- `GCASH_WEBHOOK_SECRET` dev-escape-hatch — acceptable *only* because the prod/demo env sets it; the warning is logged.

No Critical or High security issues remain.

---

# Production Readiness

**Can this evolve beyond the hackathon? Yes — with a documented path.**

| Evolution | Trigger | Path |
|-----------|---------|------|
| Horizontal scale | >1 instance | Add Redis (bus/throttler/cron-lock); single-worker cron election |
| Real off-ramp | Regulated anchor partner | SEP-6/SEP-24 + SEP-12 KYC (at the anchor, not Kreav) + SEP-38 quotes |
| Real on-ramp | Regulated on-ramp | SEP-6/SEP-24 (replaces mocked GCash) |
| Creator auth sessions | Multi-tenant | SEP-10 → JWT |
| Reliability SLOs | Real users | Prometheus + OpenTelemetry |
| Contract trust | Pre-mainnet | Formal verification (Certora/Scout) + Soroban Audit Bank |
| Funding automation | Post-mock | Real on-ramp credits the float automatically (replaces manual pre-fund) |

The **pre-funded float model (C1)** is explicitly an MVP/ops mechanism; production replaces it with real on-ramp credits. The architecture is designed to absorb that swap without redesign.

---

# Final Verdict

## ⚠ Needs Revision → ✅ Approved for Implementation

The architecture is sound, skills-aligned, and honestly scoped. The two Critical findings (C1 funding gap, C2 conflicting drafts) and three High findings (H1 secret env var, H2 `order_ref` mapping, H3 `createdAt`) are **documentation/ops gaps, not design defects** — and all are resolved by the approved revisions applied in Step 2 (documented in `docs/reviews/Final-Consistency-Report.md`).

No load-bearing decision requires redesign. **Implementation (BE-007 onward) is approved to begin** once the revisions land.

---

*Companion: `docs/reviews/Final-Consistency-Report.md` — post-revision validation confirming every Critical/High issue is closed and no contradictions remain.*
