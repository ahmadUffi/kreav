# Branching Strategy

> **Status:** Canonical Git workflow for Kreav. Mirrors the binding rules in [`AGENTS.md`](../../AGENTS.md); this doc explains the *why*.
> **Authoritative refs:** [AGENTS.md](../../AGENTS.md) (Backend Working Agreement), [Implementation Backlog](../backend/Implementation-Backlog.md).

## Branch model

```
main          ← stable releases only (deliberate promote from develop)
 └── develop  ← integration source of truth (PRs land here)
      └── be/<slug>   ← backend feature branch (one per issue)
      └── fe/<slug>   ← frontend feature branch
      └── bc/<slug>   ← blockchain feature branch
```

- **`develop` is the working source of truth.** All PRs target `develop`, not `main`.
- **`main` is touched only via deliberate releases** promoted from `develop` — never from feature branches.
- Feature branches are short-lived (one issue = one branch = one PR).

## Branching rules

1. **Branch off `develop`**: `<team>/<kebab-slug-describing-the-issue>`.
   - Backend: `be/checkout-apis`, `be/core-entities`, `be/settlement-service`
   - Frontend: `fe/storefront`, `fe/wallet-screen`
   - Blockchain: `bc/revenue-split-contract`, `bc/platform-float`
2. **One branch per issue.** No long-lived shared branches.
3. **Delete the branch after merge.** Keep the branch list clean.
4. **Rebase/merge `develop` into your branch** if it drifts; resolve before opening the PR.

## Commit conventions — Conventional Commits + scope + issue ID

```
<type>(<scope>): <short description> (BE-XXX)
```

- **Types:** `feat`, `fix`, `chore`, `test`, `refactor`, `docs`, `ci`
- **Scopes (module names):** `config`, `prisma`, `products`, `orders`, `wallets`, `stellar`, `auth`, `users`, `common`, `events`, `notifications`
- Examples:
  - `feat(orders): create checkout endpoint (BE-005)`
  - `test(orders): checkout→webhook happy path (BE-005)`
  - `chore(prisma): add User/Product schema migration (BE-003)`
- **Commit small and often** on the branch. The final **squash** on merge produces one clean commit on `develop`.

## Merge strategy — Squash & merge (NEVER auto-merge)

> ⛔ **The AI agent MUST NEVER merge a PR by itself.** After CI goes green, the agent opens/leaves the PR open and asks the **user to review and merge**. CI green is a *prerequisite*, not a trigger. No review = no merge. (AGENTS.md)

- Workflow: agent opens PR → watches CI until green → **stops and notifies the user** → user reviews & squash-merges.
- Squash all branch commits → **one commit on `develop`** with a clean conventional message including the issue number (e.g. `feat(config): initialize NestJS backend project (BE-001) (#1)`).
- **Delete the source branch after merge.**

## CI gate

- `.github/workflows/ci.yml` runs on every PR and on `develop`: `install` → `lint` → `build` → `migrate deploy` → `test` → `test:e2e` → SonarCloud.
- **No green CI = no merge** — even if local checks pass. Fix the branch and re-run; never bypass.
- Branch protection on `develop` (require CI) to be enabled by the owner when ready.

## Issue lifecycle on the board

```
Backlog → [branch] → In progress → [PR→develop] → In review → [CI green + user merges] → Done
```

- Move the Project #10 card at each phase.
- **GitHub auto-close caveat:** `closes #X` does **not** fire for PRs into `develop` (only the default branch `main`). After the user merges, the agent **manually closes the issue + moves the card to Done.**

## Why this model

| Choice | Reason |
|--------|--------|
| Squash-merge | one clean commit per issue on `develop`; readable history; PR = the review unit |
| PRs → develop (not main) | `develop` is the integration trunk; `main` stays releasable |
| No auto-merge | human review gate; the agent never merges (AGENTS.md non-negotiable) |
| Conventional Commits | module scope + issue ID make history greppable + auto-changelog-ready |
| Short-lived branches | less merge conflict; one issue's work is reviewable in isolation |

---

*Cross-reference: commit/merge rules → [AGENTS.md](../../AGENTS.md); review rigor → [Code Review Checklist](./Code-Review-Checklist.md); DoD → [Coding Standards §16](./Coding-Standards.md#16-definition-of-done-before-opening-a-pr).*
