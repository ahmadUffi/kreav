# Prompt: Code Review

> Reusable prompt for reviewing a PR before merge.

---

You are reviewing a Kreav backend PR. Apply `docs/engineering/Code-Review-Checklist.md` exhaustively.

**Read first:** the PR diff, `AGENTS.md` (DoD), `.ai/rules.md`, and the issue's acceptance criteria.

**Universal:** CI green? · one-issue-one-PR? · `closes #X` in body? · no secrets/`.env`? · no debug code? · Conventional Commit message with scope + `(BE-XXX)`? · docs updated if API/schema/flow changed?

**Money & integrity:** money as Decimal/string (never number/float)? · fresh Decimal copies (no aliasing)? · money writes in `$transaction`? · no recompute of a contract split? · idempotency respected (`paymentRef`/`order_ref`)?

**API/DTO:** `whitelist`+`forbidNonWhitelisted`+`transform`? · money as decimal string? · pagination bounded? · response shape matches `docs/api/API-Standards.md`? · errors use `docs/api/Error-Codes.md` codes (no ad-hoc HttpException)?

**State/flow:** Order transitions through the state machine? · retries verify (not re-invoke)? · event payloads match typed contracts? · notifications async/non-blocking?

**Security:** no hardcoded creds? · webhook HMAC verified? · `PLATFORM_WALLET_SECRET` never logged if touched? · rate limits on sensitive endpoints?

**Testing:** unit tests for new logic? · e2e happy + key failure path? · money tests assert Decimal values? · mocks at the client seam? · regression test for any fixed audit finding? · coverage ≥95% on money/split/state?

**Stellar (if touched):** simulate→assemble before submit? · poll getTransaction? · trustline check? · 7-decimal scaling? · txHash/explorer surfaced?

**DB (if touched):** migration committed? · no destructive migration? · `@map` casing preserved? · index for new query patterns?

**Output:** blocking comments (🔴 must-fix) vs nits (🟢). Auto-request-changes on: money as number, settlement recompute, missing `$transaction`, logged secret, unguarded illegal transition. **Never approve if CI is red.**
