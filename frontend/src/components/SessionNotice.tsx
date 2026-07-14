"use client";

/**
 * Shown on creator-scoped pages when there's no session. Connect now lives in the
 * top navbar, so this just points the user there — a returning wallet logs in and
 * a new wallet is taken into creator onboarding, both from the "Connect wallet"
 * button. (The `need` prop is kept for call-site compatibility.)
 */
export function SessionNotice(_props: { need?: "account" | "wallet" }) {
  return (
    <div
      className="flex flex-col items-center text-center"
      style={{
        padding: 44,
        background: "var(--card)",
        border: "1px solid var(--line, rgba(10,10,10,.14))",
        borderRadius: "var(--r, 10px)",
        boxShadow: "var(--shadow-sm, 0 1px 2px rgba(10,10,10,.06))",
      }}
    >
      <div style={{ fontSize: 42, marginBottom: 12 }}>👛</div>
      <div className="mb-2" style={{ fontFamily: "var(--font-mono)", fontSize: 17, fontWeight: 700 }}>
        Connect your wallet
      </div>
      <p
        className="mb-1 max-w-[420px]"
        style={{ fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.6, color: "var(--muted)" }}
      >
        Use the{" "}
        <strong style={{ color: "var(--text)" }}>Connect wallet</strong> button in the top bar. New
        here? Connecting takes you through a quick creator setup — then your dashboard opens.
      </p>
    </div>
  );
}
