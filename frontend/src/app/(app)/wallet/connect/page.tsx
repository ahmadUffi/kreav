"use client";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card } from "@/components/ui";
import WalletConnectPanel from "@/components/WalletConnectPanel";
import { getUserId, setWalletAddress } from "@/lib/api/session";
import { connectWallet } from "@/lib/api/wallet";

export default function WalletConnectPage() {
  const router = useRouter();
  const addressRef = useRef<string | null>(null);

  const onContinue = async () => {
    const address = addressRef.current;
    if (address) {
      setWalletAddress(address);
      // Creator identity comes from the session token (Fase 1).
      if (getUserId()) {
        try {
          await connectWallet({ walletAddress: address, provider: "FREIGHTER" });
        } catch {
          // Non-fatal — address is still saved locally for the wallet dashboard.
        }
      }
    }
    router.push("/dashboard");
  };

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
        <WalletConnectPanel
          onConnected={(address) => {
            addressRef.current = address;
          }}
          continueLabel="Continue to dashboard"
          onContinue={onContinue}
        />
      </Card>

      <p className="mt-5" style={{ fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.6, color: "var(--muted)" }}>
        🔒 Non-custodial: Kreav <strong style={{ color: "var(--text)" }}>never</strong> sees or stores
        your seed phrase or secret key. Signing happens inside Freighter, on your device.
      </p>
    </div>
  );
}
