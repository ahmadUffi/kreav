"use client";
import { useEffect, useState } from "react";
import { Badge, Card, Button, EmptyState, Skeleton } from "@/components/ui";
import { products, orders, wallet } from "@/lib/mock";
import { stellarTxUrl, truncateAddress } from "@/lib/stellar";

type Tab = "products" | "orders" | "wallet";

const TABS: { id: Tab; label: string }[] = [
  { id: "products", label: "Products" },
  { id: "orders", label: "Orders" },
  { id: "wallet", label: "Wallet" },
];

type Tone = "success" | "warn" | "danger";
const STATUS_TONE: Record<string, Tone> = {
  Paid: "success",
  Pending: "warn",
  Refunded: "danger",
};

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>("products");
  const [loading, setLoading] = useState(true);

  // Brief load simulation so the skeleton states are exercised (no real fetch yet).
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="mx-auto max-w-[1280px] px-10 pt-12 pb-[90px]">
      <Badge>Dashboard</Badge>
      <h1
        className="mt-4 mb-6"
        style={{ fontFamily: "var(--font-anton)", fontSize: "clamp(30px, 4.4vw, 48px)", lineHeight: 1.05 }}
      >
        Welcome back
      </h1>

      {/* Tabs */}
      <div
        className="mb-7 flex flex-wrap gap-1"
        style={{ borderBottom: "1px solid var(--line, rgba(10,10,10,.14))" }}
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 14,
                fontWeight: active ? 700 : 500,
                color: active ? "var(--text)" : "var(--muted)",
                background: "transparent",
                border: "none",
                borderBottom: `2px solid ${active ? "var(--line-strong, #0A0A0A)" : "transparent"}`,
                padding: "10px 14px",
                marginBottom: -1,
                cursor: "pointer",
                transition: "color 0.15s, border-color 0.15s",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
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
      <div className="mb-4 flex justify-end">
        <Button variant="primary">+ New product</Button>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
        {mine.map((p) => (
          <Card key={p.id} hover padding={0} style={{ overflow: "hidden" }}>
            <div className="flex h-[100px] items-center justify-center" style={{ background: p.accent, fontSize: 40 }}>
              {p.emoji}
            </div>
            <div className="p-4">
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>
                {p.title}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>{p.category}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 800 }}>${p.price}</span>
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
          className="flex flex-wrap items-center justify-between gap-4"
          style={{
            padding: "16px 20px",
            borderTop: i === 0 ? "none" : "1px solid var(--line, rgba(10,10,10,.14))",
          }}
        >
          <div style={{ minWidth: 200 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700 }}>{o.product}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              {o.id} · {o.buyer} · {o.date}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge tone={STATUS_TONE[o.status]}>{o.status}</Badge>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 800, minWidth: 56, textAlign: "right" }}>
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
    <div className="grid items-start gap-6 md:grid-cols-[minmax(220px,320px)_1fr]">
      {/* Balance card */}
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
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid var(--line, rgba(10,10,10,.14))",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          Recent transactions
        </div>
        {wallet.transactions.map((t, i) => (
          <div
            key={t.id}
            className="flex items-center justify-between gap-4"
            style={{
              padding: "14px 20px",
              borderTop: i === 0 ? "none" : "1px solid var(--line, rgba(10,10,10,.14))",
            }}
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
  );
}

/** Visual-only loading placeholders for each tab. */
function LoadingTab({ tab }: { tab: Tab }) {
  if (tab === "products") {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} padding={0} style={{ overflow: "hidden" }}>
            <Skeleton height={100} style={{ borderRadius: 0 }} />
            <div className="p-4">
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
      <div className="grid items-start gap-6 md:grid-cols-[minmax(220px,320px)_1fr]">
        <Card>
          <Skeleton height={14} width="60%" style={{ marginBottom: 14 }} />
          <Skeleton height={40} style={{ marginBottom: 18 }} />
          <Skeleton height={42} />
        </Card>
        <Card padding={0} style={{ overflow: "hidden" }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ padding: "16px 20px", borderTop: i === 0 ? "none" : "1px solid var(--line, rgba(10,10,10,.14))" }}>
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
          className="flex items-center justify-between gap-4"
          style={{ padding: "16px 20px", borderTop: i === 0 ? "none" : "1px solid var(--line, rgba(10,10,10,.14))" }}
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
