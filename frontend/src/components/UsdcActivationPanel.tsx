"use client";
import { useState } from "react";
import { Button } from "@/components/ui";
import { activateUsdc } from "@/lib/api/wallet";

type Phase = "idle" | "signing" | "done" | "failed";

interface UsdcActivationPanelProps {
  /** The creator's connected wallet address — Freighter signs as this account. */
  address: string;
  /** Called after the trustline is established on-chain. */
  onActivated?: () => void;
}

/**
 * Sponsored USDC activation (Fase 1.5). Shown when a creator's wallet has no
 * USDC trustline yet. The platform pays the network fee and sponsors the
 * reserve (CAP-33) — the creator only signs once in Freighter. Non-custodial:
 * signing stays inside the extension.
 *
 * App surface (refined neo-brutalism): soft tokens, one yellow primary action.
 */
export default function UsdcActivationPanel({ address, onActivated }: UsdcActivationPanelProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [detail, setDetail] = useState<string | null>(null);

  const activate = async () => {
    setPhase("signing");
    setDetail(null);
    try {
      await activateUsdc(address);
      setPhase("done");
      onActivated?.();
    } catch (e) {
      setDetail(e instanceof Error ? e.message : "Activation failed. Try again.");
      setPhase("failed");
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "16px 20px",
        borderRadius: "var(--r, 10px)",
        border: "1px solid var(--tone-warn-fg, #9a6a00)",
        background: "var(--tone-warn-bg, rgba(255,196,0,.12))",
      }}
    >
      <div style={{ minWidth: 220, flex: 1 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
          {phase === "done" ? "USDC activated" : "Activate USDC to receive payouts"}
        </div>
        <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 12.5, lineHeight: 1.55, color: "var(--muted)" }}>
          {phase === "done"
            ? "Your wallet can now receive USDC settlements."
            : "Your wallet needs a one-time USDC trustline before it can be paid. The network fee and reserve are covered by Kreav — you just sign once."}
          {phase === "failed" && detail ? ` — ${detail}` : ""}
        </p>
      </div>
      {phase !== "done" && (
        <Button variant="primary" onClick={activate} disabled={phase === "signing"}>
          {phase === "signing" ? "Sign in Freighter…" : phase === "failed" ? "Try again" : "Activate USDC"}
        </Button>
      )}
    </div>
  );
}
