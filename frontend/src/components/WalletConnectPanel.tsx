"use client";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import { truncateAddress } from "@/lib/stellar";
import { isConnected, requestAccess, getNetwork } from "@stellar/freighter-api";

export type WalletState =
  | "idle"
  | "not-installed"
  | "connecting"
  | "connected"
  | "rejected"
  | "wrong-network";

const FREIGHTER_URL = "https://www.freighter.app/";
const REQUIRED_NETWORK = "TESTNET";

interface WalletConnectPanelProps {
  /** Called once when the wallet reaches the connected state, with the real address. */
  onConnected?: (address: string) => void;
  /** Optional primary action shown on the connected state (e.g. "Continue"). */
  continueLabel?: string;
  onContinue?: () => void;
}

function errMessage(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === "string") return error;
  const m = (error as { message?: string }).message;
  return m ?? "Something went wrong.";
}

/**
 * Real Freighter connect flow (@stellar/freighter-api v6). Reused by the
 * standalone /wallet/connect page and the onboarding wizard. Non-custodial —
 * we only read the public address; signing stays inside the extension.
 */
export default function WalletConnectPanel({ onConnected, continueLabel, onContinue }: WalletConnectPanelProps) {
  const [state, setState] = useState<WalletState>("idle");
  const [address, setAddress] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  const connect = async () => {
    setState("connecting");
    setDetail(null);
    try {
      const conn = await isConnected();
      if (conn.error || !conn.isConnected) {
        setState("not-installed");
        return;
      }
      const access = await requestAccess();
      if (access.error || !access.address) {
        setDetail(errMessage(access.error));
        setState("rejected");
        return;
      }
      const net = await getNetwork();
      if (!net.error && net.network && net.network.toUpperCase() !== REQUIRED_NETWORK) {
        setDetail(`Freighter is on ${net.network}. Switch to Testnet.`);
        setState("wrong-network");
        return;
      }
      setAddress(access.address);
      setState("connected");
      onConnected?.(access.address);
    } catch (e) {
      setDetail(e instanceof Error ? e.message : "Connection failed.");
      setState("rejected");
    }
  };

  const heading: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 17, fontWeight: 700, marginBottom: 6 };
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

  if (state === "connected" && address) {
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
          title={address}
        >
          {truncateAddress(address)}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {continueLabel && (
            <Button variant="primary" onClick={onContinue}>
              {continueLabel}
            </Button>
          )}
          <Button variant="secondary" onClick={() => { setAddress(null); setState("idle"); }}>
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
        <p style={body}>{detail ?? "You declined the connection in Freighter. Try again when ready."}</p>
        <Button variant="primary" onClick={connect}>
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
        <p style={body}>{detail ?? "Switch Freighter to Testnet, then reconnect."}</p>
        <Button variant="primary" onClick={connect}>
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
      <Button variant="primary" onClick={connect}>
        Connect Freighter
      </Button>
    </div>
  );
}
