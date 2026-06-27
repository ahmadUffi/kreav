# API Versioning

> **Status:** Canonical versioning + backward-compatibility strategy.
> **Authoritative refs:** [Backend PRD §9](../backend/Backend-PRD.md), [API Standards](./API-Standards.md).

## Current state

**MVP: unversioned.** The API has a single consumer (the Kreav frontend) and a single deployment. No `/v1/` prefix is used. Endpoints live at the root: `/products`, `/checkout`, `/wallet/balance`, etc.

## Strategy (when versioning becomes necessary)

**URI path versioning** (`/v2/...`) when a breaking change is unavoidable. Rationale:

| Strategy | Kreav verdict |
|----------|---------------|
| **URI versioning** (`/v2/products`) | ✅ Adopt when needed — explicit, cache-friendly, easy to route |
| Header versioning (`Accept: application/vnd.kreav.v2+json`) | ❌ Hidden; hard to test/debug; poor tooling support |
| Query versioning (`?version=2`) | ❌ Muddies caching; easy to forget |

## Breaking vs non-breaking changes

**Non-breaking (no version bump):**
- Adding a new endpoint.
- Adding an optional request field.
- Adding a new response field.
- Loosening validation.
- Changing error `message` text (the `code` is the stable contract).

**Breaking (requires a new version):**
- Removing or renaming a field/endpoint.
- Changing a field's type (e.g. `priceUsd` string → number).
- Tightening validation that rejects previously-valid input.
- Changing an error `code`.
- Changing money serialization (the decimal-string contract).

## Backward compatibility rules

1. **Money is a 2-decimal decimal string — forever.** This is a permanent contract (see [API Standards §8](./API-Standards.md#8-money-serialization-critical)). A future version cannot change it.
2. **Error `code`s are immutable** once released ([Error-Codes](./Error-Codes.md)). New conditions get new codes; old codes keep their meaning.
3. **State names are immutable** (the 13 `OrderStatus` values). Add states; never rename/remove.
4. New response fields are additive — clients must ignore unknown fields (forward-compatible).

## Deprecation

When a new version ships, the old version is supported for one demo cycle, with a `Deprecation` header + `Sunset` header indicating the removal date. No long-term multi-version support in MVP scope.

---

*Cross-reference: endpoint catalog → [API Standards §14](./API-Standards.md#14-endpoint-catalog).*
