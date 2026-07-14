"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui";
import { useSession } from "@/lib/api/useSession";
import { useApiQuery } from "@/lib/api/hooks";
import { getBalance, activateUsdc } from "@/lib/api/wallet";

/**
 * Dashboard-wide reminder: a creator must activate a USDC trustline before they
 * can create products (solo OR collaborative) — the backend rejects product
 * creation without a payable wallet. Shows only when signed in and the wallet
 * has no trustline; hidden on the wallet page (which has the full panel).
 */
export default function TrustlineBanner() {
  const pathname = usePathname();
  const { ready, userId, walletAddress } = useSession();
  const enabled = ready && !!userId && !!walletAddress && pathname !== "/dashboard/wallet";
  const { data, loading, refetch } = useApiQuery(() => getBalance(), [walletAddress], enabled);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!enabled || loading || !data || data.hasUsdcTrustline) return null;

  const activate = async () => {
    if (!walletAddress) return;
    setErr(null);
    setBusy(true);
    try {
      await activateUsdc(walletAddress);
      refetch();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Activation failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="mb-6 flex flex-wrap items-center gap-4"
      style={{
        padding: "14px 18px",
        borderRadius: "var(--r, 10px)",
        border: "1px solid var(--tone-warn-fg, #b26a00)",
        background: "var(--tone-warn-bg, rgba(255,196,0,.12))",
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1 }}>⚠️</span>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>
          Activate USDC to start selling
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--muted)", marginTop: 2, lineHeight: 1.5 }}>
          Your wallet needs a USDC trustline before you can create a product — solo or collaborative.
          One click, no XLM required (we sponsor it).
          {err && <span style={{ color: "var(--tone-danger-fg, #b23a00)" }}> — {err}</span>}
        </div>
      </div>
      <Button variant="primary" onClick={activate} disabled={busy}>
        {busy ? "Activating…" : "Activate USDC"}
      </Button>
    </div>
  );
}
