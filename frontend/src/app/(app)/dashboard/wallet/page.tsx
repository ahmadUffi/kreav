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
import type { WithdrawalDestination, WithdrawalReceipt } from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";

const DESTINATIONS: WithdrawalDestination[] = ["GCASH", "GOPAY", "PAYNOW", "BANK"];

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
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>Loading…</p>
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
                      {t.date} ·{" "}
                      <a
                        href={t.explorerLink}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "var(--muted)", textDecoration: "underline", textUnderlineOffset: 2 }}
                      >
                        view on explorer ↗
                      </a>
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
        <WithdrawForm
          maxAmount={wallet?.balance ?? 0}
          onClose={() => setShowForm(false)}
          onDone={() => refetch()}
        />
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
      if (pollsRef.current >= 20) clearInterval(id);
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
              <div className="kv-blink" style={{ fontSize: 36, marginBottom: 10 }}>⏳</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700 }}>Processing withdrawal…</div>
              <p style={{ margin: "6px 0 0", fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--muted)" }}>
                {receipt ? `Reference ${receipt.reference}` : "Submitting request…"}
              </p>
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

function ReceiptRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4" style={{ padding: "8px 0", borderTop: "1px solid var(--line, rgba(10,10,10,.14))" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--muted)" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 700, textAlign: "right" }}>{value}</span>
    </div>
  );
}
