# Architecture Consistency Check

> Appended to the three new Stellar PRDs (Stellar Standards, Anchor, Soroban Contract) as the closing verification section. This file is the canonical home; each PRD references it.
>
> **Update (Final Architecture Review):** the follow-on `docs/reviews/Final-Architecture-Review.md` found 2 Critical + 3 High issues (C1 funding-float gap, C2 conflicting `jawaban-prompt-*` drafts, H1 `PLATFORM_WALLET_SECRET`, H2 `order_ref` mapping, H3 `SettlementRecipient.createdAt`) — **all resolved** by revisions applied during the review (see `docs/reviews/Final-Consistency-Report.md`). This check is current as of that revision.

---

## A. No contradictions with the Backend PRD

The three new PRDs were written against `docs/backend/Backend-PRD.md` v3 + v3.1 addendum. Checks:

| Backend PRD element | New PRDs' position | Consistent? |
|---------------------|--------------------|-------------|
| §4 Principle 3 / §11: Non-custodial, backend stores only public key | Stellar Standards §0, §8: Non-custodial confirmed | ✅ |
| §11 Soroban: `Input 10 USDC / Output 9.50 Creator / 0.50 Platform` | Soroban Contract §0, §3: same 95/5 split | ✅ |
| §19: split executed by the Soroban contract | Soroban Contract §1: contract does the split, backend mirrors | ✅ |
| §19: 1 Settlement + N SettlementRecipients | Soroban Contract §4: backend records 1 + N mirroring contract output | ✅ |
| §20: 13-state Order machine (incl. WAITING_WALLET, SETTLEMENT_FAILED) | Soroban Contract §11 / Anchor §11 reference these states | ✅ |
| §20 Failure Matrix: "Missing Trustline → settlement blocked" | Soroban Contract §3/§9: `op_no_trust` → revert → SETTLEMENT_FAILED/WAITING_WALLET | ✅ |
| §8: Wallet providers Freighter + Lobstr | Stellar Standards §8: Freighter (primary) + Lobstr (secondary) | ✅ |
| §15 env vars: `HORIZON_URL`, `SOROBAN_RPC_URL`, `PLATFORM_WALLET_ADDRESS`, `USDC_ASSET_CODE`, `USDC_ISSUER` | Stellar Standards §6, §7 reference these; add `SPLIT_CONTRACT_ID` | ✅ (1 new var — see §C) |
| §9: `GET /wallet/balance` sourced from Horizon | Anchor §3, §12: balance via Horizon `loadAccount` | ✅ |
| §9: `POST /wallet/withdraw` returns `processing` | Anchor §3, §12: mock anchor startWithdrawal → `processing` | ✅ |
| Architecture diagram: "Mock SEP-24 Anchor" | Anchor §0, §4: SEP-24 mocked in MVP | ✅ |

### Identified divergences (explicit, intentional)

| # | Divergence | Why it's intentional |
|---|------------|----------------------|
| D-1 | New PRDs state **RPC is primary, Horizon secondary** for Soroban — the Backend PRD lists both as equals | The `data` skill mandates RPC as preferred for new/Soroban code. Documented in Stellar Standards §7. Horizon stays for balance/explorer. |
| D-2 | New PRDs add **`SPLIT_CONTRACT_ID`** env var | Required to invoke the deployed split contract. Not in Backend PRD §15 — see §C item 1. |
| D-3 | New PRDs specify **USDC 7-decimal scaling** | The Backend PRD stores `Decimal(18,2)`; the on-chain base-unit conversion is new detail. See §C item 2. |
| D-4 | New PRDs make the **platform account the settlement signer** explicit | Backend PRD implies this (someone must invoke); new PRDs name the mechanism + security tradeoff (ED-2). |

None of these break the Backend PRD's contract; they **refine** it with Stellar-specific mechanics from the official skills.

---

## B. No contradictions between the three new PRDs

| Cross-reference | Stellar Standards | Anchor | Soroban Contract | Consistent? |
|-----------------|-------------------|--------|------------------|-------------|
| Non-custodial | §0, §8 (defines) | §0, §5 (inherits) | §0, §8 (inherits) | ✅ |
| USDC = classic via SAC, 7 decimals | §3 (defines) | — | §0, §3 (inherits) | ✅ |
| Split 95/5, contract does it | §1 (overview) | — | §0, §3, §4 (defines) | ✅ |
| RPC primary / Horizon secondary | §6, §7 (defines) | §5 (inherits, balance via Horizon) | §10 (inherits, settle via RPC) | ✅ |
| Platform account = settlement signer | §4, ED-2 (defines) | §5 (inherits) | §8 (defines mechanism) | ✅ |
| Mocked anchor in MVP | — | §0, §1 (defines) | — (out of scope) | ✅ |
| Settlement real / off-ramp mocked | §4 table | §0, §2, §3 | §5, §11 | ✅ |
| Order states (WAITING_WALLET, SETTLEMENT_FAILED) | — | §11 | §11 | ✅ |
| USDC testnet issuer/SAC addresses | §3 (defines) | — | §3 (inherits) | ✅ |
| Future roadmap alignment | §10 (SEPs) | §15 (anchor) | §15 (contracts) | ✅ no overlap conflicts |

**No contradictions found.** Terminology is consistent across the three (non-custodial, 95/5, creator pool, SAC, RPC-primary, mocked anchor, WAITING_WALLET all used identically).

---

## C. Changes the Backend PRD should receive after these documents

These are the concrete edits to `docs/backend/Backend-PRD.md` to bring it into alignment with the new Stellar PRDs (driven by the official Stellar skills):

### 1. Add env var `SPLIT_CONTRACT_ID`
**§15 Environment variables** — add:
```
SPLIT_CONTRACT_ID=         # deployed Revenue Split contract address (C...)
```
**Reason:** the SettlementService must invoke the split contract; its address is a required config (Soroban Contract PRD §10).

### 2. Document USDC 7-decimal scaling
**§11 (Soroban) or a new subsection** — add a note that USDC uses **7 decimals on Stellar** and that the backend must scale `Decimal(18,2)` ↔ on-chain base units (`amount_base = amount_usd × 10^7`).
**Reason:** official USDC scaling (assets/agentic-payments skills); a silent 10×/100× bug otherwise.

### 3. Record the custodial→non-custodial resolution
**§4 Principle 3** — already states Non-Custodial. Add an explicit pointer: *"Resolves the contradiction with `docs/product/Product-Scope.md`'s 'Sponsored Custodial Wallet' wording — Non-Custodial is the decided state (see Stellar Standards PRD §0). The Product Scope should be updated."*
**Reason:** the audit of existing docs surfaced a live contradiction (Stellar Standards PRD §0).

### 4. Update `docs/product/Product-Scope.md` wallet wording
**Product Scope # Wallet Strategy** — change "Sponsored Custodial Wallet" to **"Non-Custodial (creator-supplied Freighter/Lobstr wallet; backend stores only the public key)."**
**Reason:** consistency with the decided non-custodial model (§0).

### 5. Clarify RPC vs Horizon roles
**§11 / §15** — add a one-liner: *"Soroban RPC (`SOROBAN_RPC_URL`) is the primary for contract invocation + settlement verification; Horizon (`HORIZON_URL`) is used for balance reads and explorer display."*
**Reason:** the `data` skill mandates RPC-primary for new code (Stellar Standards §7).

### 6. Specify the platform account as settlement signer
**§10 (Settlement Flow) or §11** — add: *"The platform account (`PLATFORM_WALLET_ADDRESS`) signs and submits the settlement transaction; its key is held server-side and never exposed. Creators' wallets only receive."*
**Reason:** makes the signing authority explicit + flags it as the one secret to guard (Soroban Contract §8, Stellar Standards ED-2).

### 7. Add `op_no_trust` → state mapping
**§20 Failure Matrix** — add an explicit row: *"Missing USDC trustline (creator) → `op_no_trust` on settle → Order `WAITING_WALLET` (deferred until trustline created), or `SETTLEMENT_FAILED` if already mid-settle."*
**Reason:** the assets skill's `op_no_trust` failure is a real settlement blocker that must map to a defined state (Soroban Contract §3/§9).

### 8. (Optional) Reference the new PRDs
Add a short "Stellar-specific design" pointer section near the top directing readers to the three new PRDs for chain/anchor/contract mechanics, so contributors know where Stellar truth lives.

---

### Summary
- **Backend PRD contradictions:** none (4 intentional refinements from the skills, documented).
- **Inter-PRD contradictions:** none.
- **Backend PRD changes:** 8 concrete edits (6 substantive, 2 pointer/cleanup), all traceable to official Stellar skills.

The three new PRDs are internally consistent and consistent with the Backend PRD, with the sole **resolved** contradiction (custodial vs non-custodial) documented in §0 of each.
