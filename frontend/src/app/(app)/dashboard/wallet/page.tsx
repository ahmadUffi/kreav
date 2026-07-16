"use client";
import { useEffect, useRef, useState } from "react";
import { Card, Button, Input } from "@/components/ui";
import { useSession } from "@/lib/api/useSession";
import { useApiQuery } from "@/lib/api/hooks";
import { SessionNotice } from "@/components/SessionNotice";
import UsdcActivationPanel from "@/components/UsdcActivationPanel";
import { truncateAddress } from "@/lib/stellar";
import { getWallet } from "@/lib/api/wallet";
import { createWithdrawal, getWithdrawal } from "@/lib/api/withdrawals";
import {
  authenticateAnchor,
  startAnchorWithdrawal,
  pollAnchorTx,
  sendUsdcToAnchor,
} from "@/lib/api/sep24";
import type { WithdrawalDestination, WithdrawalReceipt } from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";
import { WalletSkeleton } from "@/components/skeletons";

const DESTINATIONS: WithdrawalDestination[] = ["GCASH", "GOPAY", "PAYNOW", "BANK"];

/** Fase 2A: when enabled, the Withdraw button opens the real SEP-24 anchor flow. */
const ANCHOR_ENABLED = process.env.NEXT_PUBLIC_ANCHOR_ENABLED === "true";

// SDF test anchor SEP-24 per-withdrawal limits (from /sep24/info). Testnet only —
// when pointing at a production anchor, fetch these from the anchor's /info instead.
const ANCHOR_MIN_USDC = 1;
const ANCHOR_MAX_USDC = 10;

export default function DashboardWalletPage() {
  const { ready, walletAddress } = useSession();
  const { data: wallet, loading, error, refetch } = useApiQuery(
    () => getWallet(),
    [walletAddress],
    ready && !!walletAddress,
  );
  const [showForm, setShowForm] = useState(false);

  if (ready && !walletAddress) return <SessionNotice need="wallet" />;

  return (
    <div>
      <h1 className="mb-5" style={{ fontFamily: "var(--font-anton)", fontSize: "clamp(26px, 3.4vw, 38px)", lineHeight: 1.05 }}>
        Wallet
      </h1>

      {!ready || loading ? (
        <WalletSkeleton />
      ) : error ? (
        <Card className="text-center" style={{ padding: 32 }}>
          <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>{error.message}</p>
        </Card>
      ) : wallet ? (
        <>
        {!wallet.hasUsdcTrustline && (
          <div className="mb-6">
            <UsdcActivationPanel address={wallet.address} onActivated={() => refetch()} />
          </div>
        )}
        <div className="grid items-start gap-6 md:grid-cols-[minmax(220px,320px)_1fr]">
          {/* Balance */}
          <Card style={{ background: "var(--text)", color: "var(--bg)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, opacity: 0.7 }}>
              Available balance
            </div>
            <div style={{ fontFamily: "var(--font-anton)", fontSize: 40, lineHeight: 1, margin: "10px 0 4px" }}>
              ${wallet.balance.toLocaleString("en-US")}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, opacity: 0.7 }}>{wallet.currency}</div>
            <div className="mt-2" style={{ fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.6 }} title={wallet.address}>
              {truncateAddress(wallet.address)}
            </div>
            <div className="mt-5">
              <Button variant="primary" fullWidth disabled={wallet.balance <= 0} onClick={() => setShowForm(true)}>
                Withdraw
              </Button>
            </div>
          </Card>

          {/* Transactions */}
          <Card padding={0} style={{ overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--line, rgba(10,10,10,.14))", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700 }}>
              Recent transactions
            </div>
            {wallet.transactions.length === 0 ? (
              <div style={{ padding: 20, fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>
                No transactions yet.
              </div>
            ) : (
              wallet.transactions.map((t, i) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-4"
                  style={{ padding: "14px 20px", borderTop: i === 0 ? "none" : "1px solid var(--line, rgba(10,10,10,.14))" }}
                >
                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{t.label}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                      {t.date}
                      {t.explorerLink && (
                        <>
                          {" · "}
                          <a
                            href={t.explorerLink}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "var(--muted)", textDecoration: "underline", textUnderlineOffset: 2 }}
                          >
                            view on explorer ↗
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 15,
                      fontWeight: 800,
                      color: t.type === "credit" ? "var(--tone-success-fg, #0a7a45)" : "var(--muted)",
                    }}
                  >
                    {t.type === "credit" ? "+" : "−"}${t.amount}
                  </span>
                </div>
              ))
            )}
          </Card>
        </div>
        </>
      ) : null}

      {showForm && walletAddress && (
        ANCHOR_ENABLED ? (
          <AnchorWithdrawFlow
            walletAddress={walletAddress}
            maxAmount={wallet?.balance ?? 0}
            onClose={() => setShowForm(false)}
            onDone={() => refetch()}
          />
        ) : (
          <WithdrawForm
            maxAmount={wallet?.balance ?? 0}
            onClose={() => setShowForm(false)}
            onDone={() => refetch()}
          />
        )
      )}
    </div>
  );
}

function WithdrawForm({
  maxAmount,
  onClose,
  onDone,
}: {
  maxAmount: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [destinationType, setDestinationType] = useState<WithdrawalDestination>("GCASH");
  const [destinationAccount, setDestinationAccount] = useState("");
  const [phase, setPhase] = useState<"form" | "processing" | "done" | "failed">("form");
  const [receipt, setReceipt] = useState<WithdrawalReceipt | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const pollsRef = useRef(0);

  // Poll the withdrawal until it settles.
  useEffect(() => {
    if (phase !== "processing" || !receipt) return;
    pollsRef.current = 0;
    const id = setInterval(async () => {
      pollsRef.current += 1;
      try {
        const latest = await getWithdrawal(receipt.withdrawalId);
        setReceipt(latest);
        if (latest.status === "COMPLETED") {
          setPhase("done");
          clearInterval(id);
          onDone();
          return;
        }
        if (latest.status === "FAILED") {
          setPhase("failed");
          clearInterval(id);
          return;
        }
      } catch {
        /* transient — keep polling */
      }
      if (pollsRef.current >= 20) {
        clearInterval(id);
        setPollTimedOut(true);
      }
    }, 3000);
    return () => clearInterval(id);
  }, [phase, receipt, onDone]);

  const submit = async () => {
    setErr(null);
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt < 0.01) return setErr("Enter an amount of at least 0.01.");
    if (amt > maxAmount) return setErr(`You can withdraw at most $${maxAmount.toLocaleString("en-US")}.`);
    if (!destinationAccount.trim()) return setErr("Enter your destination account.");
    setPhase("processing");
    try {
      const r = await createWithdrawal({
        amount: amt,
        destinationType,
        destinationAccount: destinationAccount.trim(),
      });
      setReceipt(r);
      if (r.status === "COMPLETED") {
        setPhase("done");
        onDone();
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Withdrawal couldn't be started.");
      setPhase("form");
    }
  };

  return (
    <div
      onClick={phase === "form" ? onClose : undefined}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(10,10,10,.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "8vh 16px",
        overflowY: "auto",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460 }}>
        <Card style={{ padding: 24 }}>
          <div className="mb-4 flex items-center justify-between">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700 }}>Withdraw funds</span>
            <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 18, color: "var(--muted)" }}>
              ✕
            </button>
          </div>

          {phase === "form" && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Input id="amount" label={`Amount (USDC) — available $${maxAmount.toLocaleString("en-US")}`} placeholder="50.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <div>
                  <label htmlFor="dest" style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, marginBottom: 7 }}>
                    Destination
                  </label>
                  <select
                    id="dest"
                    value={destinationType}
                    onChange={(e) => setDestinationType(e.target.value as WithdrawalDestination)}
                    style={{
                      width: "100%",
                      fontFamily: "var(--font-mono)",
                      fontSize: 14,
                      padding: "12px 14px",
                      borderRadius: "var(--r-sm, 8px)",
                      border: "1.5px solid var(--line, rgba(10,10,10,.14))",
                      background: "var(--card)",
                      color: "var(--card-text)",
                    }}
                  >
                    {DESTINATIONS.map((d) => (
                      <option key={d} value={d} style={{ color: "#0A0A0A" }}>{d}</option>
                    ))}
                  </select>
                </div>
                <Input id="acct" label="Destination account" placeholder="09xx xxx xxxx / account no." value={destinationAccount} onChange={(e) => setDestinationAccount(e.target.value)} />
              </div>
              {err && (
                <p style={{ margin: "12px 0 0", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--tone-danger-fg, #b23a00)" }}>{err}</p>
              )}
              <div className="mt-5 flex justify-end gap-3">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button variant="primary" onClick={submit}>Withdraw</Button>
              </div>
            </>
          )}

          {phase === "processing" && (
            <div className="text-center" style={{ padding: "12px 0" }}>
              {pollTimedOut ? (
                <>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--muted)" }}>
                    Taking longer than expected
                  </div>
                  <p style={{ margin: "6px 0 0", fontFamily: "var(--font-mono)", fontSize: 12.5, lineHeight: 1.6, color: "var(--muted)" }}>
                    The transaction may still be processing on Stellar. You can close this
                    page and check back later.
                  </p>
                </>
              ) : (
                <>
                  <div className="kv-blink" style={{ fontSize: 36, marginBottom: 10 }}>⏳</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700 }}>Processing withdrawal…</div>
                  <p style={{ margin: "6px 0 0", fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--muted)" }}>
                    {receipt ? `Reference ${receipt.reference}` : "Submitting request…"}
                  </p>
                </>
              )}
            </div>
          )}

          {(phase === "done" || phase === "failed") && receipt && (
            <div>
              <div
                className="mb-3"
                style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: phase === "done" ? "var(--tone-success-fg, #0a7a45)" : "var(--tone-danger-fg, #b23a00)" }}
              >
                {phase === "done" ? "✓ Withdrawal complete" : "Withdrawal failed"}
              </div>
              <ReceiptRow label="Reference" value={receipt.reference} />
              <ReceiptRow label="Amount" value={`$${receipt.amount.toLocaleString("en-US")}`} />
              <ReceiptRow label="Status" value={receipt.status} />
              <ReceiptRow label="Destination" value={`${receipt.destinationType} · ${receipt.destinationAccount}`} />
              {receipt.settlementExplorerUrl && (
                <ReceiptRow
                  label="Settlement"
                  value={
                    <a href={receipt.settlementExplorerUrl} target="_blank" rel="noreferrer" style={{ color: "var(--text)", textDecoration: "underline" }}>
                      view on explorer ↗
                    </a>
                  }
                />
              )}
              {receipt.simulation && (
                <p style={{ margin: "12px 0 0", fontFamily: "var(--font-mono)", fontSize: 11.5, lineHeight: 1.6, color: "var(--muted)" }}>
                  {receipt.simulation.message}
                </p>
              )}
              <div className="mt-5 flex justify-end">
                <Button variant="primary" onClick={onClose}>Done</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

type AnchorPhase =
  | "form"
  | "authorizing"
  | "interactive"
  | "awaiting_transfer"
  | "sending"
  | "polling"
  | "done"
  | "failed";

/**
 * Real SEP-24 off-ramp (Fase 2A). Non-custodial: the creator signs the SEP-10
 * challenge and the USDC send in Freighter; the backend proxies the anchor.
 * Reuses the WithdrawForm modal shell + poll pattern.
 */
function AnchorWithdrawFlow({
  walletAddress,
  maxAmount,
  onClose,
  onDone,
}: {
  walletAddress: string;
  maxAmount: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<AnchorPhase>("form");
  const [token, setToken] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);
  const [interactiveUrl, setInteractiveUrl] = useState<string | null>(null);
  const [anchorStatus, setAnchorStatus] = useState<string>("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const pollsRef = useRef(0);

  const dismissable = phase === "form" || phase === "done" || phase === "failed";

  // Poll the anchor transaction while the withdrawal is in flight.
  useEffect(() => {
    const active = phase === "interactive" || phase === "awaiting_transfer" || phase === "polling";
    if (!active || !token || !txId) return;
    pollsRef.current = 0;
    const timer = setInterval(async () => {
      pollsRef.current += 1;
      try {
        const res = await pollAnchorTx(txId, token);
        setAnchorStatus(res.status);
        if (res.mappedStatus === "COMPLETED") {
          setPhase("done");
          clearInterval(timer);
          onDone();
          return;
        }
        if (res.mappedStatus === "FAILED") {
          setErr(`Anchor reported: ${res.status}`);
          setPhase("failed");
          clearInterval(timer);
          return;
        }
        if (res.status === "pending_user_transfer_start" && phase === "interactive") {
          setPhase("awaiting_transfer");
        }
      } catch {
        /* transient — keep polling */
      }
      if (pollsRef.current >= 80) {
        clearInterval(timer);
        setPollTimedOut(true);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [phase, token, txId, onDone]);

  const start = async () => {
    setErr(null);
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt)) return setErr("Enter a valid amount.");
    if (amt < ANCHOR_MIN_USDC) return setErr(`Minimum is ${ANCHOR_MIN_USDC} USDC per withdrawal (test anchor limit).`);
    if (amt > ANCHOR_MAX_USDC) return setErr(`Maximum is ${ANCHOR_MAX_USDC} USDC per withdrawal on the testnet anchor. Cash out in smaller amounts.`);
    if (amt > maxAmount) return setErr(`You only have $${maxAmount.toLocaleString("en-US")} available.`);
    // Open the popup NOW — synchronously inside the click gesture — so the
    // browser makes it a real popup WINDOW, not a tab. (Opening it after the
    // awaits below loses the user-gesture context and Chrome falls back to a
    // tab.) We navigate the blank popup to the anchor URL once we have it.
    const w = 460;
    const h = 720;
    const left = Math.max(0, Math.round((window.screen.width - w) / 2));
    const top = Math.max(0, Math.round((window.screen.height - h) / 2));
    const features = `popup,width=${w},height=${h},left=${left},top=${top}`;
    const popup = window.open("about:blank", "kreav-anchor", features);

    setPhase("authorizing");
    try {
      const anchorToken = await authenticateAnchor(walletAddress);
      setToken(anchorToken);
      const { url, id } = await startAnchorWithdrawal(anchorToken, amt);
      setTxId(id);
      setInteractiveUrl(url);
      if (popup && !popup.closed) {
        popup.location.href = url;
        popup.focus?.();
      } else {
        // Popup was blocked → the "Re-open anchor form" link is the fallback.
        window.open(url, "kreav-anchor", features);
      }
      setPhase("interactive");
    } catch (e) {
      if (popup && !popup.closed) popup.close();
      setErr(e instanceof ApiError || e instanceof Error ? e.message : "Could not reach the anchor.");
      setPhase("form");
    }
  };

  const sendFunds = async () => {
    if (!token || !txId) return;
    setErr(null);
    setPhase("sending");
    try {
      const hash = await sendUsdcToAnchor(walletAddress, txId, token);
      setTxHash(hash);
      setPhase("polling");
    } catch (e) {
      setErr(e instanceof ApiError || e instanceof Error ? e.message : "The USDC transfer failed.");
      setPhase("awaiting_transfer");
    }
  };

  return (
    <div
      onClick={dismissable ? onClose : undefined}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(10,10,10,.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "8vh 16px",
        overflowY: "auto",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460 }}>
        <Card style={{ padding: 24 }}>
          <div className="mb-4 flex items-center justify-between">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700 }}>
              Cash out (SEP-24)
            </span>
            <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 18, color: "var(--muted)" }}>
              ✕
            </button>
          </div>

          {phase === "form" && (
            <>
              <Input
                id="anchor-amount"
                label={`Amount (USDC) — ${ANCHOR_MIN_USDC}–${ANCHOR_MAX_USDC} on testnet · balance $${maxAmount.toLocaleString("en-US")}`}
                placeholder="5"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p style={{ margin: "10px 0 0", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
                You&apos;ll sign in with Freighter, complete KYC + payout details in the anchor
                window, then send your USDC to the anchor.
              </p>
              {err && <p style={{ margin: "12px 0 0", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--tone-danger-fg, #b23a00)" }}>{err}</p>}
              <div className="mt-5 flex justify-end gap-3">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button variant="primary" onClick={start}>Start cash out</Button>
              </div>
            </>
          )}

          {phase === "authorizing" && (
            <StepNote emoji="🔑" title="Authorizing with the anchor…" note="Approve the signature request in Freighter." />
          )}

          {phase === "interactive" && (
            <div className="text-center" style={{ padding: "8px 0" }}>
              <StepNote emoji="📝" title="Complete the anchor form" note="A window opened for KYC + payout details. Finish it, then come back — we’ll detect it automatically." />
              {interactiveUrl && (
                <a href={interactiveUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--text)", textDecoration: "underline" }}>
                  Re-open anchor form ↗
                </a>
              )}
              <p style={{ margin: "10px 0 0", fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--muted)" }}>
                {anchorStatus ? `Status: ${anchorStatus}` : "Waiting for the anchor…"}
              </p>
            </div>
          )}

          {phase === "awaiting_transfer" && (
            <div className="text-center" style={{ padding: "8px 0" }}>
              <StepNote emoji="💸" title="Send your USDC" note="The anchor is ready. Send your USDC to complete the cash out — approve the transfer in Freighter." />
              {err && <p style={{ margin: "10px 0 0", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--tone-danger-fg, #b23a00)" }}>{err}</p>}
              <div className="mt-4 flex justify-center">
                <Button variant="primary" onClick={sendFunds}>Send USDC</Button>
              </div>
            </div>
          )}

          {(phase === "sending" || phase === "polling") && (
            pollTimedOut ? (
              <div className="text-center" style={{ padding: "12px 0" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--muted)" }}>
                  Taking longer than expected
                </div>
                <p style={{ margin: "6px 0 0", fontFamily: "var(--font-mono)", fontSize: 12.5, lineHeight: 1.6, color: "var(--muted)" }}>
                  The transaction may still be processing on Stellar. You can close this
                  page and check back later.
                </p>
              </div>
            ) : (
              <StepNote
                emoji="⏳"
                title={phase === "sending" ? "Submitting your transfer…" : "Waiting for the anchor to pay out…"}
                note={anchorStatus ? `Status: ${anchorStatus}` : "This can take a moment."}
              />
            )
          )}

          {(phase === "done" || phase === "failed") && (
            <div>
              <div className="mb-3" style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: phase === "done" ? "var(--tone-success-fg, #0a7a45)" : "var(--tone-danger-fg, #b23a00)" }}>
                {phase === "done" ? "✓ Cash out complete" : "Cash out failed"}
              </div>
              {txId && <ReceiptRow label="Anchor tx" value={txId.slice(0, 12) + "…"} />}
              <ReceiptRow label="Amount" value={`$${amount}`} />
              {anchorStatus && <ReceiptRow label="Status" value={anchorStatus} />}
              {txHash && (
                <ReceiptRow
                  label="USDC transfer"
                  value={
                    <a href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} target="_blank" rel="noreferrer" style={{ color: "var(--text)", textDecoration: "underline" }}>
                      view on explorer ↗
                    </a>
                  }
                />
              )}
              {err && <p style={{ margin: "12px 0 0", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--tone-danger-fg, #b23a00)" }}>{err}</p>}
              <div className="mt-5 flex justify-end">
                <Button variant="primary" onClick={onClose}>Done</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function StepNote({ emoji, title, note }: { emoji: string; title: string; note: string }) {
  return (
    <div className="text-center" style={{ padding: "12px 0" }}>
      <div className="kv-blink" style={{ fontSize: 36, marginBottom: 10 }}>{emoji}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700 }}>{title}</div>
      <p style={{ margin: "6px 0 0", fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>{note}</p>
    </div>
  );
}

function ReceiptRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4" style={{ padding: "8px 0", borderTop: "1px solid var(--line, rgba(10,10,10,.14))" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--muted)" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 700, textAlign: "right" }}>{value}</span>
    </div>
  );
}
