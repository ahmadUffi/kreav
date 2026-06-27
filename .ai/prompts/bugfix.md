# Prompt: Bugfix

> Reusable prompt for fixing a bug.

---

You are fixing a bug in the Kreav backend. **Bug:** <description / repro / observed vs expected>.

**Before fixing, read:**
1. `.ai/rules.md` — the invariants (the bug likely violates one).
2. `docs/api/Error-Codes.md` — match the observed failure to a code + recovery path.
3. `docs/architecture/Runtime-Flow-Bible.md` (state machine, failure recovery) + the relevant `Sequence-Diagram-Bible.md` sequence.
4. `docs/backend/Backend-PRD.md` §20 (Failure Matrix) — the intended failure behavior.

**Method (systematic debugging):**
1. **Reproduce** reliably (write a failing test that captures the bug).
2. **Find root cause** — not a symptom. Trace from the observed error code/state backwards through the sequence.
3. **Minimal fix** — prefer correcting the logic over a workaround; the fix must not violate `.ai/rules.md`.
4. **Regression test** — the failing test now passes; add it permanently so the bug can't return.
5. **Check for siblings** — does the same flaw exist in a parallel path (e.g. another endpoint with the same pattern)?

**Money/sttlement bugs (extra rigor):**
- Confirm no fund-loss path: a failed settle must not move funds partially (atomicity); a failed withdrawal must not move creator USDC in MVP.
- If the bug is a double-settle risk, treat as 🔴 Critical — verify the `order_ref`/`paymentRef` idempotency guards.

**Workflow:** branch `be/fix-<slug>` off `develop`; Conventional Commit `fix(<scope>): <desc> (BE-XXX)`; PR to `develop`; never auto-merge. DoD same as a feature.
