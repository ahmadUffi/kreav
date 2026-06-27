"use client";
import { useState } from "react";
import { Badge, Card, Button, ErrorState, EmptyState, Skeleton } from "@/components/ui";
import { products, orders, wallet } from "@/lib/mock";
import { stellarTxUrl, truncateAddress } from "@/lib/stellar";

type Tab = "products" | "orders" | "wallet";

const TABS: { id: Tab; label: string }[] = [
  { id: "products", label: "Products" },
  { id: "orders", label: "Orders" },
  { id: "wallet", label: "Wallet" },
];

const STATUS_COLOR: Record<string, string> = {
  Paid: "#FFE600",
  Pending: "#00F5FF",
  Refunded: "#FF4D00",
};

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>("products");
  // UI shell: toggles to demo the loading + error states (no real fetching).
  const [simulateError, setSimulateError] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "60px 40px 90px" }}>
      <Badge>Dashboard</Badge>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: 16,
          margin: "20px 0 30px",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-anton)",
            fontSize: "clamp(34px, 5vw, 58px)",
            textTransform: "uppercase",
            lineHeight: 1,
            margin: 0,
          }}
        >
          Welcome back
        </h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setLoading((s) => !s);
              setSimulateError(false);
            }}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
              padding: "7px 12px",
              cursor: "pointer",
              background: loading ? "#FFE600" : "transparent",
              color: loading ? "#0A0A0A" : "var(--text)",
              border: "2px solid #0A0A0A",
            }}
          >
            {loading ? "Loading: on" : "Simulate loading"}
          </button>
          <button
            onClick={() => {
              setSimulateError((s) => !s);
              setLoading(false);
            }}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
              padding: "7px 12px",
              cursor: "pointer",
              background: simulateError ? "#FF4D00" : "transparent",
              color: simulateError ? "#0A0A0A" : "var(--text)",
              border: "2px solid #0A0A0A",
            }}
          >
            {simulateError ? "Error: on" : "Simulate error"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 30, flexWrap: "wrap" }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: 1,
                textTransform: "uppercase",
                padding: "12px 22px",
                cursor: "pointer",
                background: active ? "#0A0A0A" : "var(--card)",
                color: active ? "#FFE600" : "var(--card-text)",
                border: "3px solid #0A0A0A",
                borderRight: t.id === "wallet" ? "3px solid #0A0A0A" : "none",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {simulateError ? (
        <ErrorState
          description="We couldn't load your dashboard data. This is a demo of the ErrorState primitive."
          onRetry={() => setSimulateError(false)}
        />
      ) : loading ? (
        <LoadingTab tab={tab} />
      ) : (
        <>
          {tab === "products" && <ProductsTab />}
          {tab === "orders" && <OrdersTab />}
          {tab === "wallet" && <WalletTab />}
        </>
      )}
    </div>
  );
}

function ProductsTab() {
  // Pretend the signed-in creator owns the first four products.
  const mine = products.slice(0, 4);
  if (mine.length === 0) {
    return <EmptyState title="No products yet" description="Publish your first digital product to start selling." actionLabel="New product" />;
  }
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
        <Button variant="primary">+ New product</Button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 20,
        }}
      >
        {mine.map((p) => (
          <Card key={p.id} hover padding={0}>
            <div
              style={{
                height: 110,
                background: p.accent,
                borderBottom: "3px solid #0A0A0A",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 42,
              }}
            >
              {p.emoji}
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ fontFamily: "var(--font-anton)", fontSize: 17, textTransform: "uppercase", lineHeight: 1.05 }}>
                {p.title}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>{p.category}</span>
                <span style={{ fontFamily: "var(--font-anton)", fontSize: 16 }}>${p.price}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function OrdersTab() {
  if (orders.length === 0) {
    return <EmptyState title="No orders yet" description="Orders from buyers will appear here." />;
  }
  return (
    <Card padding={0} style={{ overflow: "hidden" }}>
      {orders.map((o, i) => (
        <div
          key={o.id}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "16px 20px",
            borderTop: i === 0 ? "none" : "2px solid #0A0A0A",
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 200 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700 }}>{o.product}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>
              {o.id} · {o.buyer} · {o.date}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase",
                padding: "5px 10px",
                background: STATUS_COLOR[o.status],
                color: "#0A0A0A",
                border: "2px solid #0A0A0A",
              }}
            >
              {o.status}
            </span>
            <span style={{ fontFamily: "var(--font-anton)", fontSize: 18, minWidth: 56, textAlign: "right" }}>
              ${o.amount}
            </span>
          </div>
        </div>
      ))}
    </Card>
  );
}

function WalletTab() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 320px) 1fr", gap: 24, alignItems: "start" }}>
      {/* Balance card */}
      <Card style={{ background: "#0A0A0A", color: "#FFE600", border: "3px solid #0A0A0A" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", opacity: 0.8 }}>
          Available balance
        </div>
        <div style={{ fontFamily: "var(--font-anton)", fontSize: 44, lineHeight: 1, margin: "10px 0 4px" }}>
          ${wallet.balance.toLocaleString("en-US")}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, opacity: 0.8 }}>{wallet.currency}</div>
        <div style={{ marginTop: 20 }}>
          <Button variant="primary" fullWidth>Withdraw</Button>
        </div>
      </Card>

      {/* Transactions */}
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "2px solid #0A0A0A", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
          Recent transactions
        </div>
        {wallet.transactions.map((t) => (
          <div
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              padding: "14px 20px",
              borderTop: "1px solid var(--muted)",
            }}
          >
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{t.label}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
                {t.date} ·{" "}
                <a
                  href={stellarTxUrl(t.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--text)", textDecoration: "underline", textUnderlineOffset: 2 }}
                >
                  tx {truncateAddress(t.txHash)} ↗
                </a>
              </div>
            </div>
            <span
              style={{
                fontFamily: "var(--font-anton)",
                fontSize: 17,
                color: t.type === "credit" ? "#0A0A0A" : "#FF4D00",
                background: t.type === "credit" ? "#FFE600" : "transparent",
                padding: t.type === "credit" ? "2px 8px" : "2px 0",
              }}
            >
              {t.type === "credit" ? "+" : "−"}${t.amount}
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}

/** Visual-only loading placeholders for each tab (no real fetching). */
function LoadingTab({ tab }: { tab: Tab }) {
  if (tab === "products") {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 20,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} padding={0}>
            <Skeleton height={110} />
            <div style={{ padding: 16 }}>
              <Skeleton height={16} style={{ marginBottom: 10 }} />
              <Skeleton height={12} width="50%" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (tab === "wallet") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 320px) 1fr", gap: 24, alignItems: "start" }}>
        <Card>
          <Skeleton height={14} width="60%" style={{ marginBottom: 14 }} />
          <Skeleton height={40} style={{ marginBottom: 18 }} />
          <Skeleton height={44} />
        </Card>
        <Card padding={0} style={{ overflow: "hidden" }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ padding: "16px 20px", borderTop: i === 0 ? "none" : "1px solid var(--muted)" }}>
              <Skeleton height={13} width="70%" style={{ marginBottom: 8 }} />
              <Skeleton height={11} width="40%" />
            </div>
          ))}
        </Card>
      </div>
    );
  }

  // orders
  return (
    <Card padding={0} style={{ overflow: "hidden" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "16px 20px",
            borderTop: i === 0 ? "none" : "2px solid #0A0A0A",
          }}
        >
          <div style={{ flex: 1, maxWidth: 240 }}>
            <Skeleton height={14} style={{ marginBottom: 8 }} />
            <Skeleton height={11} width="60%" />
          </div>
          <Skeleton height={20} width={70} />
        </div>
      ))}
    </Card>
  );
}
