"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Card, Button } from "@/components/ui";
import WalletConnectPanel from "@/components/WalletConnectPanel";
import { loginWithFreighter } from "@/lib/api/auth";
import { setToken, setUserId, setUsername, setWalletAddress } from "@/lib/api/session";
import { ApiError } from "@/lib/api/client";

type Phase = "connect" | "signing" | "failed";

/**
 * Returning-creator login (Fase 1) — SEP-10 wallet auth:
 * connect Freighter → sign the server challenge → session JWT.
 * Non-custodial: signing happens inside the extension.
 */
export default function LoginPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("connect");
  const [error, setError] = useState<string | null>(null);

  const signIn = async (address: string) => {
    setPhase("signing");
    setError(null);
    try {
      const session = await loginWithFreighter(address);
      setToken(session.token);
      setUserId(session.user.id);
      setUsername(session.user.name);
      setWalletAddress(address);
      router.push("/dashboard");
    } catch (e) {
      setError(
        e instanceof ApiError || e instanceof Error
          ? e.message
          : "Sign-in failed. Try again.",
      );
      setPhase("failed");
    }
  };

  return (
    <div className="mx-auto max-w-[560px] px-10 pt-12 pb-[90px]">
      <Badge>Sign in</Badge>
      <h1
        className="mt-4 mb-2"
        style={{ fontFamily: "var(--font-anton)", fontSize: "clamp(30px, 4.4vw, 48px)", lineHeight: 1.05 }}
      >
        Welcome back
      </h1>
      <p
        className="mb-8 max-w-[460px]"
        style={{ fontFamily: "var(--font-mono)", fontSize: 14, lineHeight: 1.7, color: "var(--muted)" }}
      >
        Sign in with your Stellar wallet — connect Freighter and approve a
        one-time signature. No password needed.
      </p>

      <Card style={{ padding: 32 }}>
        {phase === "signing" ? (
          <div className="text-center">
            <div className="kv-blink" style={{ fontSize: 40, marginBottom: 12 }}>✍️</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 17, fontWeight: 700, marginBottom: 6 }}>
              Waiting for your signature…
            </div>
            <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.6, color: "var(--muted)" }}>
              Approve the sign-in request in the Freighter popup.
            </p>
          </div>
        ) : phase === "failed" ? (
          <div className="text-center">
            <div style={{ fontSize: 40, marginBottom: 12 }}>✋</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 17, fontWeight: 700, marginBottom: 6 }}>
              Sign-in failed
            </div>
            <p style={{ margin: "0 0 20px", fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.6, color: "var(--muted)" }}>
              {error ?? "Something went wrong."}
            </p>
            <Button variant="primary" onClick={() => setPhase("connect")}>
              Try again
            </Button>
          </div>
        ) : (
          <WalletConnectPanel onConnected={(address) => void signIn(address)} />
        )}
      </Card>

      <p className="mt-5" style={{ fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.6, color: "var(--muted)" }}>
        New to Kreav?{" "}
        <Link href="/signup" style={{ color: "var(--text)", fontWeight: 700 }}>
          Create an account
        </Link>
        {" "}· 🔒 Non-custodial — we never see your seed phrase or secret key.
      </p>
    </div>
  );
}
