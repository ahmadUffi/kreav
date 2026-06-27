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

const STATES: { id: WalletState; label: string }[] = [
  { id: "idle", label: "Idle" },
  { id: "not-installed", label: "Not installed" },
  { id: "connecting", label: "Connecting" },
  { id: "connected", label: "Connected" },
  { id: "rejected", label: "Rejected" },
  { id: "wrong-network", label: "Wrong network" },
];

const FREIGHTER_URL = "https://www.freighter.app/";

export default function WalletConnectPage() {
  const router = useRouter();
  const [state, setState] = useState<WalletState>("idle");

  // Mock the connect handshake: connecting → connected after a beat.
  useEffect(() => {
    if (state !== "connecting") return;
    const t = setTimeout(() => setState("connected"), 1500);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <div className="mx-auto max-w-[620px] px-10 pt-15 pb-[90px]">
      <Badge>Wallet</Badge>
      <h1
        className="mt-5 mb-3"
        style={{ fontFamily: "var(--font-anton)", fontSize: "clamp(34px, 5vw, 56px)", textTransform: "uppercase", lineHeight: 1 }}
      >
        Connect your wallet
      </h1>
      <p
        className="mb-7 max-w-[480px]"
        style={{ fontFamily: "var(--font-mono)", fontSize: 14, lineHeight: 1.7, color: "var(--muted)" }}
      >
        Kreav settles payouts on Stellar. Connect the Freighter browser extension to
        receive funds — it stays on your device and you keep custody at all times.
      </p>

      {/* State preview switcher (UI shell — no real extension calls yet). */}
      <div className="mb-6 flex flex-wrap gap-2">
        {STATES.map((s) => (
          <button
            key={s.id}
            onClick={() => setState(s.id)}
            className="px-2.5 py-[6px]"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: "uppercase",
              cursor: "pointer",
              background: state === s.id ? "#FFE600" : "transparent",
              color: state === s.id ? "#0A0A0A" : "var(--text)",
              border: "2px solid #0A0A0A",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <Card style={{ padding: 36 }}>
        <StateContent state={state} setState={setState} router={router} />
      </Card>

      {/* Non-custodial assurance */}
      <p
        className="mt-6"
        style={{ fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.6, color: "var(--muted)" }}
      >
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
    fontFamily: "var(--font-anton)",
    fontSize: 22,
    textTransform: "uppercase",
    marginBottom: 8,
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
        <div style={{ fontSize: 44, marginBottom: 12 }}>🦊</div>
        <div style={heading}>Freighter not found</div>
        <p style={body}>You&apos;ll need the free Freighter extension to connect a Stellar wallet.</p>
        <a
          href={FREIGHTER_URL}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-block",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "#0A0A0A",
            background: "#FFE600",
            border: "3px solid #0A0A0A",
            boxShadow: "6px 6px 0 #0A0A0A",
            padding: "13px 22px",
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
        <div className="kv-blink" style={{ fontSize: 44, marginBottom: 12 }}>⏳</div>
        <div style={heading}>Connecting…</div>
        <p style={body}>Approve the connection request in the Freighter popup.</p>
      </div>
    );
  }

  if (state === "connected") {
    return (
      <div className="text-center">
        <div style={{ marginBottom: 12 }}>
          <Badge brackets={false} style={{ background: "#00F5FF", fontSize: 11 }}>
            ● Connected
          </Badge>
        </div>
        <div style={heading}>Wallet connected</div>
        <p style={body}>You&apos;re ready to receive Stellar payouts.</p>
        <div
          className="mx-auto mb-5 inline-block"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 15,
            fontWeight: 700,
            color: "var(--card-text)",
            background: "var(--bg)",
            border: "2px solid #0A0A0A",
            padding: "10px 16px",
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
        <div style={{ fontSize: 44, marginBottom: 12 }}>✋</div>
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
        <div style={{ fontSize: 44, marginBottom: 12 }}>🔀</div>
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
      <div style={{ fontSize: 44, marginBottom: 12 }}>👛</div>
      <div style={heading}>Connect Freighter</div>
      <p style={body}>Link your non-custodial Stellar wallet to start receiving payouts.</p>
      <Button variant="primary" onClick={() => setState("connecting")}>
        Connect Freighter
      </Button>
    </div>
  );
}
