# Demo Failure Recovery

> **Status:** What to do when something goes wrong on stage. Each failure has a defined recovery — never improvise.
> **Authoritative refs:** [Backend PRD §20](../backend/Backend-PRD.md) (Failure Matrix), [Error-Codes](../api/Error-Codes.md), [Demo Playbook](./Demo-Playbook.md), [Security-Audit #20](../security/Security-Audit.md).

**Golden rule:** *audience focus is the money movement, not the mechanics.* Narrate calmly; recover silently where possible; fall back to the recorded proof if a live step is unrecoverable.

---

## On-stage failures & recovery

### RPC unavailable (settlement won't submit/verify)
- **Symptom:** settlement hangs; `RPC_TIMEOUT` / `SETTLEMENT_PENDING`.
- **Recovery:** retry verify (the backend does this automatically, up to 3×). If it persists >15s, **switch to the pre-recorded txHash** (Security-Audit #20 contingency) and narrate: *"the settlement is on-chain — here's the transaction"* → open the recorded explorer link.
- **Never:** claim success if no txHash exists.

### Wallet disconnected (creator wallet)
- **Symptom:** `WAITING_WALLET` / balance read fails.
- **Recovery:** reconnect the pre-connected wallet quickly (the presenter has access). This is why wallets are pre-connected — reconnect should be one click.
- **Never:** create a new wallet or show a seed phrase on stage.

### Contract revert (`CONTRACT_REVERT` / `op_no_trust` / insufficient source)
- **Symptom:** `SETTLEMENT_FAILED`.
- **Recovery:** this is a real failure — a missing trustline or depleted float. If **trustline** → it shouldn't happen (pre-demo checklist). If **float depleted** → top up via the bookmarked faucet, then retry the purchase. If unrecoverable fast → fall back to the recorded txHash + narrate.

### No trustline (creator can't receive USDC)
- **Symptom:** pre-settle `WAITING_WALLET` or mid-settle `op_no_trust`.
- **Recovery:** should never happen on stage (wallets pre-trustlined). If it does, skip to the recorded proof — do **not** add a trustline live (jargon + risk).

### Low float (platform USDC depleted)
- **Symptom:** `INSUFFICIENT_FLOAT` / settle reverts.
- **Recovery:** top up the platform account via the bookmarked Circle testnet faucet (BC-011), then retry the purchase. Keep the float ≥ ~100 USDC to avoid this entirely.

### Webhook failure (GCash mock didn't fire / signature rejected)
- **Symptom:** checkout created but Order stays `PAYMENT_PENDING`; or `INVALID_SIGNATURE`.
- **Recovery:** if the mock didn't fire, trigger it manually (the mock has a trigger). If signature rejected → `GCASH_WEBHOOK_SECRET` mismatch; should be caught in the pre-demo checklist. If unrecoverable, narrate the settlement from a triggered/recorded state.

### Internet unstable
- **Symptom:** frontend can't reach backend; explorer won't load.
- **Recovery:** switch to the **hotspot backup**. Pre-load the explorer link offline if possible. Narrate the flow from the dashboard's last-known state.

### Email/notification failure (`NOTIFICATION_FAILED`)
- **Symptom:** the creator "you received 9.50" email doesn't arrive.
- **Recovery:** **irrelevant to the demo** — notifications are async and never block the settlement. Ignore it on stage; the balance + txHash are the proof.

### Database restart / backend redeploy mid-demo
- **Symptom:** transient 5xx.
- **Recovery:** the **startup recovery job** (audit #18) resumes stuck orders. Wait a few seconds and refresh. If persistent, fall back to the recorded proof.

---

## Demo fallback strategy (last resort)

If the **live settlement is unrecoverable** (Testnet down, contract broken, etc.):
1. **Narrate honestly:** *"the network is congested right now — let me show you a completed settlement from our prep."*
2. Open the **pre-recorded txHash** in the explorer — the audience sees the real split (9.50 / 0.50) on a real transaction.
3. Continue the wallet/withdrawal beats using the recorded state.

The contingency exists so the demo **never** shows a broken flow. Honesty + a prepared real example beats a flaky live attempt.

---

## Money-safety invariants during recovery
- A failed settlement never causes **fund loss** — the contract is atomic (all-or-nothing); a revert returns funds to the source.
- A failed withdrawal never moves the creator's USDC in MVP (the mock anchor moves nothing).
- The recorded txHash is a **real** past settlement — not fabricated.

---

*Cross-reference: error mapping → [Error-Codes](../api/Error-Codes.md); failure matrix → [Backend PRD §20](../backend/Backend-PRD.md); pre-demo guard → [Demo Checklist](./Demo-Checklist.md).*
