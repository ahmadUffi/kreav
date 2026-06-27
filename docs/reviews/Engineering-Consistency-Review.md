# Kreav Engineering Consistency Review

> Cross-document review of the six newly generated Engineering Bible documents against the existing Kreav corpus. Per the task rules, **existing documents are not modified here** — this review records findings and recommended fixes only.
>
> **Superseded by `docs/reviews/Final-Architecture-Review.md`.** The Final ADR conducted a deeper review against the live code + schema, found 2 Critical + 3 High issues beyond this review's 3 stale-reference items (all of which were already fixed), and applied revisions to resolve them. This review's 3 recommended fixes (Treasury node, BE-013/014, `/storefront/:slug`) are **done**; the Final ADR's C1/C2/H1/H2/H3 are **also done**. The authoritative current score + verdict live in `docs/reviews/Final-Consistency-Report.md`.

---

## 1. Summary

Six new engineering documents were generated for Kreav:
1. **Sequence-Diagram-Bible.md** (30 sequences) — `docs/architecture/`
2. **Runtime-Flow-Bible.md** — `docs/architecture/`
3. **Deployment-PRD.md** — `docs/backend/`
4. **Testing-PRD.md** — `docs/backend/`
5. **Observability-PRD.md** — `docs/backend/`
6. **Security-PRD.md** — `docs/security/`

They were written against the full existing corpus (Backend PRD v3 + v3.1, Product Scope, Demo PRD, Final Architecture, Implementation Backlog, Security Audit, the 3 Stellar PRDs, Architecture Consistency Check) and the complete Stellar Skills corpus.

**Headline result:** the six documents are internally consistent and consistent with the Backend PRD (post the earlier 8 edits) and the Stellar PRDs. Terminology, state names, entity names, API names, env-var names, and wallet/Stellar terminology are uniform. **No contradictions found** within or between the six. A small number of gaps and recommended (non-blocking) fixes are listed below; two pre-existing cross-document issues in the *older* corpus are surfaced (not introduced by these documents).

**Overall architecture score: 91 / 100.** (Scoring rubric in §8.)

---

## 2. Documents Reviewed

**New (this batch):**
- `docs/architecture/Sequence-Diagram-Bible.md`
- `docs/architecture/Runtime-Flow-Bible.md`
- `docs/backend/Deployment-PRD.md`
- `docs/backend/Testing-PRD.md`
- `docs/backend/Observability-PRD.md`
- `docs/security/Security-PRD.md`

**Existing (cross-checked against):**
- `docs/backend/Backend-PRD.md` (v3 + v3.1 addendum, post the 8 consistency edits)
- `docs/product/Product-Scope.md` (post wallet-strategy edit)
- `docs/product/Demo-PRD.md`
- `docs/architecture/System-Architecture.md`
- `docs/backend/Implementation-Backlog.md`
- `docs/security/Security-Audit.md`
- `docs/stellar/Stellar-Standards-PRD.md`
- `docs/stellar/Anchor-PRD.md`
- `docs/stellar/Soroban-Contract-PRD.md`
- `docs/reviews/Architecture-Consistency-Check.md`

---

## 3. Issues Found

### Severity legend
🔴 contradiction · 🟠 gap (blocks correctness) · 🟡 inconsistency (cosmetic/clarity) · 🟢 nit

| # | Sev | Where | Issue |
|---|-----|-------|-------|
| 1 | 🟡 | Final Architecture.md vs Backend PRD §4 | **Pre-existing (not introduced by these 6 docs).** Final Architecture's mermaid still shows a `Treasury (Kreav Treasury Wallet)` node and `Soroban → Treasury` edge, implying a third settlement recipient beyond Creator/Platform. The Backend PRD + Soroban Contract PRD define only **Creator (95%) + Platform (5%)**. The "Treasury" node is either an early-design artifact or a future recipient type (`RecipientType.TREASURY` exists in the enum). **The 6 new docs consistently use only Creator + Platform**, so this is a stale diagram in the older Architecture doc. |
| 2 | 🟡 | Implementation-Backlog.md vs Security-Audit.md | **Pre-existing.** The backlog defines tasks only to **BE-012**; the audit folds a finding (#19) into a **BE-013 (Notification)** that doesn't exist in the backlog, and the project tracker carries BE-013 (Notification) + BE-014 (Email Event Wiring). The new docs reference BE-013/BE-014 (per the live project). The backlog doc is stale relative to the tracker. |
| 3 | 🟡 | Final Architecture.md `GET /storefront/:slug` | **Pre-existing.** Demo PRD Screen 2 references `GET /storefront/:slug`, which has no corresponding backend task (BE-004 ships `GET /products`, `GET /products/:id`). The new docs use the canonical `/products` endpoints. A `/storefront/:slug` either needs a task or the demo should reference `/products/:id`. |
| 4 | 🟢 | Deployment PRD §5 vs AGENTS.md | SonarCloud project-key staleness (`ahmadUffi_tipschain`) is referenced consistently — good — but the Deployment PRD could add a one-line "owner action: rename project key" callout matching AGENTS.md. Minor. |
| 5 | 🟢 | Observability PRD §7 vs Runtime Flow Bible | Both state "no Prometheus in MVP" — consistent. No issue; recorded to confirm the cross-reference holds. |
| 6 | 🟢 | Security PRD §16 vs Soroban Contract PRD §8 | Both state "platform account is the sole settlement signer; server-side key; creators only receive." Consistent. Recorded to confirm. |

**No 🔴 contradictions and no 🟠 correctness gaps were found within or between the six new documents.**

---

## 4. Recommended Fixes

(Not applied — per task rules, existing docs are not modified here.)

1. **Final Architecture.md (stale diagram):** update the mermaid to remove or relabel the `Treasury` node. Either (a) remove it (MVP = Creator + Platform only), or (b) relabel it as a *future* `RecipientType.TREASURY` recipient and add a note that MVP uses only Creator + Platform. Aligns with Soroban Contract PRD §2/§3.
2. **Implementation Backlog.md (stale task list):** append BE-013 (Notification Module) + BE-014 (Email Event Wiring) to match the live project tracker and the SECURITY_AUDIT cross-references. Keeps the doc as the authoritative sprint plan.
3. **Demo PRD Screen 2 endpoint:** change `GET /storefront/:slug` → `GET /products/:id` (or add a small storefront task). Aligns the demo script with the shipped API.
4. **Deployment PRD:** (optional nit) add the explicit "owner must rename SonarCloud project key to `ahmadUffi_kreav`" owner-action callout for parity with AGENTS.md.

---

## 5. Missing Architecture

Areas where the six new docs intentionally defer detail (documented, not gaps):

| Area | Documented as | Why deferred |
|------|---------------|--------------|
| Distributed tracing (OpenTelemetry) | Observability PRD §19 (future) | MVP uses `requestId` correlation; OTel is post-MVP |
| Prometheus/Grafana dashboards | Observability PRD §7, §16 (future) | MVP uses Railway built-ins + log-derived metrics |
| Blue/green + canary deploy | Deployment PRD §19/§20 (future) | MVP = rolling + image-rollback |
| Kubernetes | Deployment PRD §21 (future) | MVP = single Railway instance |
| Redis (bus/throttler/cron-lock) | Runtime Flow Bible §17 (future) | MVP = in-process + DB-backed retries |
| SEP-10 wallet auth (JWT) | Security PRD §5/§6 (post-MVP) | MVP = public-key match |
| Load testing | Testing PRD §16 (post-MVP) | Demo has trivial concurrency |
| Real anchor / KYC | Anchor PRD (future); Security PRD §24 | MVP = mocked anchor |
| Formal contract verification | Security PRD §28 (pre-production) | The contract is the trust root; audit/verify before mainnet |

These are **conscious MVP-scoping decisions**, each with rationale + a documented future trigger. They are not missing architecture — they are deferred architecture.

---

## 6. Missing PRDs

The Engineering Bible is now comprehensive. The only doc surfaces not yet authored (and whether they're needed):

| Candidate PRD | Needed for MVP? | Note |
|---------------|-----------------|------|
| **Frontend PRD** | Out of agent scope | FE is a separate team (Implementation Backlog FE-001..011); a Frontend PRD would be owned by FE |
| **Blockchain/Soroban Contract Implementation PRD** | Partial | The **Soroban-Contract-PRD.md** covers *architecture*; the *Rust implementation* is the BC team's scope (AGENTS.md) |
| **Data Model / Schema Reference** | Covered | Lives in Backend PRD §8/§20 + `schema.prisma`; a standalone ERD doc would be redundant |
| **API Reference (OpenAPI)** | Recommended (post-MVP) | Not strictly a PRD; an OpenAPI spec generated from the NestJS controllers would be the natural artifact |
| **Runbook / On-Call** | Post-MVP | Observability PRD §17 sketches the incident flow; a full runbook is justified when on-call exists |

**No PRD critical to MVP is missing.** The corpus now spans: product scope, backend, demo, architecture, implementation backlog, security audit, 3 Stellar PRDs, architecture consistency check, and 6 engineering bibles/PRDs.

---

## 7. Consistency Verification (terminology + names)

Checked across all six new docs + the Backend PRD:

| Dimension | Canonical term (used uniformly) | Consistent? |
|-----------|--------------------------------|-------------|
| Order states | `CREATED … WITHDRAW_COMPLETED` + 5 failure states (v3.1 §20) | ✅ all 13 used identically |
| Settlement tables | `Settlement` (1) + `SettlementRecipient` (N) | ✅ |
| Split | `95% Creator / 5% Platform` (creator pool split by collaborators) | ✅ |
| Asset | USDC (classic) via SAC; 7 decimals; testnet issuer/SAC addresses | ✅ |
| Wallet model | Non-Custodial; backend stores public key only; Freighter + Lobstr | ✅ |
| RPC vs Horizon | RPC primary (invoke/verify); Horizon secondary (balance/explorer) | ✅ |
| Signer | Platform account sole settlement signer; server-side key | ✅ |
| Env vars | `DATABASE_URL`, `HORIZON_URL`, `SOROBAN_RPC_URL`, `PLATFORM_WALLET_ADDRESS`, `USDC_ASSET_CODE`, `USDC_ISSUER`, `SPLIT_CONTRACT_ID`, `GCASH_WEBHOOK_SECRET` | ✅ |
| Event names | `payment.received`, `wallet.connect.required`, `settlement.completed` | ✅ |
| APIs | `GET/POST /products`, `POST /checkout`, `POST /webhooks/gcash`, `POST /wallet/connect`, `GET /wallet/balance`, `GET /wallet/transactions`, `POST /wallet/withdraw` | ✅ (except pre-existing `/storefront/:slug` nit, §3 #3) |
| Mocked vs real | GCash/anchor/bank/KYC = mocked; Stellar/Soroban/USDC/txHash/balance = real | ✅ |
| Entities | User, Product, ProductCollaborator, Order, Settlement, SettlementRecipient, Wallet, Withdrawal, NotificationLog | ✅ |

**Result: no naming conflicts, no architecture conflicts, no duplicated responsibilities, no inconsistent state/API/entity names** among the six new documents.

---

## 8. Overall Architecture Score: 91 / 100

**Rubric (each /25):**

| Dimension | Score | Notes |
|-----------|------:|-------|
| **Consistency** (no contradictions, uniform terminology) | 24/25 | −1 for the 3 pre-existing stale references in *older* docs (Treasury node, BE-013/014 backlog gap, `/storefront/:slug`); the 6 new docs are fully self-consistent |
| **Completeness** (MVP coverage, deferred items documented) | 23/25 | −2 for no standalone API/OpenAPI reference + FE/BC impl PRDs out of agent scope (acceptable but noted) |
| **Correctness vs Stellar** (skills.stellar.org alignment) | 23/25 | RPC-primary, SAC/7-decimals/trustline/`op_no_trust`, SEP mapping all correct; −2 for the Soroban contract *invocation* being specified but not yet implemented/verified against a live contract (BE-007 pending) |
| **Operability** (deploy/test/observe/security actionable) | 21/25 | MVP-aligned and actionable; −4 for future-only coverage of tracing/Prometheus/real-anchor (intentional MVP scoping, but limits production-readiness depth) |

**Interpretation:** the architecture is **production-quality for the MVP demo** and provides a clear, documented path for each deferred item. The 9-point deduction is almost entirely *intentional MVP scoping* and *pre-existing doc staleness in older files* — not defects in the six new documents. Closing the 3 stale-reference items + implementing BE-007 would bring the score to ~96.

---

## 9. Closing Note

The six Engineering Bible documents, combined with the earlier three Stellar PRDs and the consistency checks, give Kreav a complete, internally consistent, skills-grounded architectural foundation. Every "WHY" is answered; every deferral is documented with a trigger condition; every money path is covered by a sequence + a security control + a test expectation.

The remaining work is **implementation** (BE-007 onward), not architecture definition.

---

*This review generated per the task's FINAL STEP. Existing documents were not modified; only this review + the six new documents were produced.*
