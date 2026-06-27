# Prompt: Performance Review

> Reusable prompt for a performance analysis.

---

You are reviewing Kreav backend performance. Target: <endpoint / flow / area>.

**Read first:** `.ai/architecture.md` (where the hot paths are), `docs/database/Database-Bible.md` (indexes), `docs/backend/Observability-PRD.md` (latency/metrics), `docs/backend/Deployment-PRD.md` §21 (single-instance MVP).

**Context:** MVP volume is trivial (one demo buyer). So "performance" here means: no obvious N+1, no missing index on a query pattern, no blocking the event loop, no unbounded retry/loop, sensible Prisma `select`/`include` (avoid over-fetching). Not premature micro-optimization.

**Check:**
- **DB:** N+1 queries (e.g. loading collaborators per settlement in a loop)? Missing `@@index` for a new query pattern? Over-fetching (no `select`)? Heavy queries in a hot path?
- **Stellar:** are RPC/Horizon calls cached where safe? (Balance is NOT cached as authoritative, but a short stale-tolerant cache for display is OK if labeled.) Is the `getTransaction` poll loop bounded + backoff-friendly?
- **Event loop:** any blocking sync work on the hot path? (`EventEmitter2` emit is sync — handlers must be fast/async.)
- **Retries:** bounded (max 3) + exponential backoff; no retry storms.
- **Memory:** no unbounded in-process caches; throttler/bus storage is in-process (fine for single instance).

**Output:** findings ranked by impact (only flag things that matter at MVP scale — note explicitly if something is "fine now, watch at scale"). Recommend the minimal change; cite the index/query/loop. Do not over-engineer for traffic the demo doesn't have.
