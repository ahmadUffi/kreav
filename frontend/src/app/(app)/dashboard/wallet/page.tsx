import { Card, Button } from "@/components/ui";
import { wallet } from "@/lib/mock";
import { stellarTxUrl, truncateAddress } from "@/lib/stellar";

export default function DashboardWalletPage() {
  return (
    <div>
      <h1 className="mb-5" style={{ fontFamily: "var(--font-anton)", fontSize: "clamp(26px, 3.4vw, 38px)", lineHeight: 1.05 }}>
        Wallet
      </h1>

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
          <div className="mt-5">
            <Button variant="primary" fullWidth>Withdraw</Button>
          </div>
        </Card>

        {/* Transactions */}
        <Card padding={0} style={{ overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--line, rgba(10,10,10,.14))", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700 }}>
            Recent transactions
          </div>
          {wallet.transactions.map((t, i) => (
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
                    href={stellarTxUrl(t.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "var(--muted)", textDecoration: "underline", textUnderlineOffset: 2 }}
                  >
                    tx {truncateAddress(t.txHash)} ↗
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
          ))}
        </Card>
      </div>
    </div>
  );
}
