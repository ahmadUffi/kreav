"use client";
import Link from "next/link";
import { Button, Card } from "@/components/ui";

/**
 * Shown on creator-scoped pages when the MVP session is missing. The backend has
 * no login, so we point the user at signup (userId) or wallet connect (address).
 */
export function SessionNotice({ need = "account" }: { need?: "account" | "wallet" }) {
  const wallet = need === "wallet";
  return (
    <Card className="flex flex-col items-center text-center" style={{ padding: 44 }}>
      <div style={{ fontSize: 42, marginBottom: 12 }}>{wallet ? "👛" : "🔑"}</div>
      <div className="mb-2" style={{ fontFamily: "var(--font-mono)", fontSize: 17, fontWeight: 700 }}>
        {wallet ? "Connect your wallet" : "Sign in to continue"}
      </div>
      <p
        className="mb-6 max-w-[400px]"
        style={{ fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.6, color: "var(--muted)" }}
      >
        {wallet
          ? "This page needs a connected Stellar wallet. Connect one to see your balance and payouts."
          : "This page is for signed-in creators. Create an account to access your dashboard."}
      </p>
      <Link href={wallet ? "/wallet/connect" : "/signup"} style={{ textDecoration: "none" }}>
        <Button variant="primary">{wallet ? "Connect wallet" : "Create account"}</Button>
      </Link>
    </Card>
  );
}
