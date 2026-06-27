# Prompt: Refactor

> Reusable prompt for a safe refactor (no behavior change).

---

You are refactoring Kreav backend code. **Constraint: no behavior change.** The existing tests are the safety net — they must stay green, unchanged, before and after.

**Read first:** `.ai/rules.md` (the invariants must hold post-refactor), `.ai/architecture.md` (module boundaries), `docs/engineering/Coding-Standards.md`.

**Principles:**
1. **Tests first** — confirm green before; refactor; confirm green after. If a test would need to change, it's not a refactor (it's a behavior change — stop).
2. **Minimal blast radius** — touch the fewest modules consistent with the goal.
3. **No new behavior** — no new endpoints, no new states, no new money paths. Purely structural.
4. **Preserve invariants** — money stays Decimal; state machine untouched; idempotency guards intact; non-custodial.
5. **Module boundaries** — if extracting a module, keep the event bus as the only cross-module channel.

**Allowed:** rename for clarity, extract shared helpers (watch SonarCloud duplication), simplify control flow, move code between files in the same module, tighten types (e.g. remove an `any`).

**Disallowed:** change an API shape, change an error code, change a state transition, change money handling, change a DB column, merge two modules.

**Workflow:** branch `be/refactor-<slug>` off `develop`; Conventional Commit `refactor(<scope>): <desc>`; PR to `develop`; CI must be green; never auto-merge. Note in the PR body: "Behavior-preserving; all existing tests unchanged + green."
