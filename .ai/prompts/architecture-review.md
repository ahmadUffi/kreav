# Prompt: Architecture Review

> Reusable prompt for any coding agent (Claude Code, Codex, Gemini CLI, Cursor, Zed, Windsurf). Paste below the line into the agent.

---

You are reviewing the Kreav backend for architectural soundness. Kreav is a Stellar-powered creator-settlement backend (NestJS + Prisma + PostgreSQL).

**Before reviewing, read (in this order):**
1. `AGENTS.md` and `.ai/rules.md` — the binding invariants.
2. `.ai/architecture.md` — the system shape.
3. `docs/adr/` — all immutable decisions.
4. `docs/reviews/Final-Architecture-Review.md` + `docs/reviews/Final-Consistency-Report.md`.
5. The specific code under review.

**Authority on conflict:** official Stellar docs (skills.stellar.org) → `docs/reviews/Architecture-Consistency-Check.md` → `docs/reviews/Final-Architecture-Review.md` → `docs/backend/Backend-PRD.md` → everything else.

**Review for:**
- Violations of the 8 ADRs or the invariants in `.ai/rules.md` (money-as-Decimal, non-custodial, mirror-not-recompute the split, retry-verify-not-reinvoke, state machine, idempotency).
- Stellar mechanics correctness (RPC-primary, SAC/USDC 7-decimal, trustline checks, simulate→assemble→submit).
- Module boundaries (modular monolith — no cross-module coupling except via the event bus).
- State/data integrity (transactions around money writes; FK/unique constraints).
- Security (no secrets logged, HMAC verified, whitelist/forbidNonWhitelisted).

**Output:** a severity-ranked list (🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low), each with Problem / Impact / Recommendation / Affected file(s). Do not modify code unless asked — report first. Cite the ADR/rule each finding violates.
