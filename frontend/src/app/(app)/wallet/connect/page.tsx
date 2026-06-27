"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card, Button } from "@/components/ui";
import { truncateAddress, MOCK_WALLET_ADDRESS } from "@/lib/stellar";

type WalletState =
  | "idle"
  | "not-installed"
  | "connecting"
  | "connected"
  | "rejected"
  | "wrong-network";

const FREIGHTER_URL = "https://www.freighter.app/";

export default function WalletConnectPage() {
  const router = useRouter();
  const [state, setState] = useState<WalletState>("idle");

  // Mock the connect handshake: connecting → connected after a beat.
  useEffect(() => {
    if (state !== "connecting") return;
    const t = setTimeout(() => setState("connected"), 1400);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <div className="mx-auto max-w-[560px] px-10 pt-12 pb-[90px]">
      <Badge>Wallet</Badge>
      <h1
        className="mt-4 mb-2"
        style={{ fontFamily: "var(--font-anton)", fontSize: "clamp(30px, 4.4vw, 48px)", lineHeight: 1.05 }}
      >
        Connect your wallet
      </h1>
      <p
        className="mb-8 max-w-[460px]"
        style={{ fontFamily: "var(--font-mono)", fontSize: 14, lineHeight: 1.7, color: "var(--muted)" }}
      >
        Kreav settles payouts on Stellar. Connect the Freighter extension to receive
        funds — it stays on your device and you keep custody at all times.
      </p>

      <Card style={{ padding: 32 }}>
        <StateContent state={state} setState={setState} router={router} />
      </Card>

      {/* Non-custodial assurance */}
      <p className="mt-5" style={{ fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.6, color: "var(--muted)" }}>
        🔒 Non-custodial: Kreav <strong style={{ color: "var(--text)" }}>never</strong> sees or stores
        your seed phrase or secret key. Signing happens inside Freighter, on your device.
      </p>
    </div>
  );
}

function StateContent({
  state,
  setState,
  router,
}: {
  state: WalletState;
  setState: (s: WalletState) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const heading: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 17,
    fontWeight: 700,
    marginBottom: 6,
  };
  const body: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 13,
    lineHeight: 1.6,
    color: "var(--muted)",
    margin: "0 0 20px",
  };

  if (state === "not-installed") {
    return (
      <div className="text-center">
        <div style={{ fontSize: 40, marginBottom: 12 }}>🦊</div>
        <div style={heading}>Freighter not found</div>
        <p style={body}>You&apos;ll need the free Freighter extension to connect a Stellar wallet.</p>
        <a
          href={FREIGHTER_URL}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-block",
            fontFamily: "var(--font-mono)",
            fontSize: 13.5,
            fontWeight: 700,
            color: "#0A0A0A",
            background: "var(--accent, #FFE600)",
            border: "1.5px solid var(--line-strong, #0A0A0A)",
            borderRadius: "var(--r-sm, 8px)",
            boxShadow: "var(--shadow-sm, 0 1px 2px rgba(10,10,10,.06))",
            padding: "11px 18px",
            textDecoration: "none",
          }}
        >
          Install Freighter ↗
        </a>
      </div>
    );
  }

  if (state === "connecting") {
    return (
      <div className="text-center">
        <div className="kv-blink" style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
        <div style={heading}>Connecting…</div>
        <p style={body}>Approve the connection request in the Freighter popup.</p>
      </div>
    );
  }

  if (state === "connected") {
    return (
      <div className="text-center">
        <div style={{ marginBottom: 12 }}>
          <Badge tone="success">● Connected</Badge>
        </div>
        <div style={heading}>Wallet connected</div>
        <p style={body}>You&apos;re ready to receive Stellar payouts.</p>
        <div
          className="mx-auto mb-5 inline-block"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            fontWeight: 700,
            color: "var(--card-text)",
            background: "var(--surface-2, rgba(10,10,10,.045))",
            border: "1px solid var(--line, rgba(10,10,10,.14))",
            borderRadius: "var(--r-sm, 8px)",
            padding: "9px 14px",
          }}
          title={MOCK_WALLET_ADDRESS}
        >
          {truncateAddress(MOCK_WALLET_ADDRESS)}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="primary" onClick={() => router.push("/dashboard")}>
            Continue to dashboard
          </Button>
          <Button variant="secondary" onClick={() => setState("idle")}>
            Disconnect
          </Button>
        </div>
      </div>
    );
  }

  if (state === "rejected") {
    return (
      <div className="text-center">
        <div style={{ fontSize: 40, marginBottom: 12 }}>✋</div>
        <div style={heading}>Request rejected</div>
        <p style={body}>You declined the connection in Freighter. No problem — try again when ready.</p>
        <Button variant="primary" onClick={() => setState("connecting")}>
          Try again
        </Button>
      </div>
    );
  }

  if (state === "wrong-network") {
    return (
      <div className="text-center">
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔀</div>
        <div style={heading}>Wrong network</div>
        <p style={body}>Freighter is set to a different network. Switch it to Testnet, then reconnect.</p>
        <Button variant="primary" onClick={() => setState("connecting")}>
          Reconnect
        </Button>
      </div>
    );
  }

  // idle
  return (
    <div className="text-center">
      <div style={{ fontSize: 40, marginBottom: 12 }}>👛</div>
      <div style={heading}>Connect Freighter</div>
      <p style={body}>Link your non-custodial Stellar wallet to start receiving payouts.</p>
      <Button variant="primary" onClick={() => setState("connecting")}>
        Connect Freighter
      </Button>
    </div>
  );
}
