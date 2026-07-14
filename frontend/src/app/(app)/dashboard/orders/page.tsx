"use client";
import { useEffect, useState } from "react";
import { Card, Badge, Button, EmptyState } from "@/components/ui";
import { useSession } from "@/lib/api/useSession";
import { useApiQuery } from "@/lib/api/hooks";
import { SessionNotice } from "@/components/SessionNotice";
import { listOrders, getOrder, type OrderDetailView } from "@/lib/api/orders";
import { OrderListSkeleton } from "@/components/skeletons";
import { truncateAddress } from "@/lib/stellar";
import type { OrderStatusView } from "@/lib/api/types";

type Tone = "success" | "warn" | "danger";
const STATUS_TONE: Record<OrderStatusView, Tone> = {
  Paid: "success",
  Pending: "warn",
  Failed: "danger",
};

export default function DashboardOrdersPage() {
  const { ready, userId } = useSession();
  const { data, loading, error } = useApiQuery(
    () => listOrders({ limit: 50 }),
    [userId],
    ready && !!userId,
  );
  const [openId, setOpenId] = useState<string | null>(null);

  if (ready && !userId) return <SessionNotice />;
  const orders = data?.items ?? [];

  return (
    <div>
      <h1 className="mb-5" style={{ fontFamily: "var(--font-anton)", fontSize: "clamp(26px, 3.4vw, 38px)", lineHeight: 1.05 }}>
        Orders
      </h1>

      {!ready || loading ? (
        <OrderListSkeleton />
      ) : error ? (
        <Card className="text-center" style={{ padding: 32 }}>
          <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>{error.message}</p>
        </Card>
      ) : orders.length === 0 ? (
        <EmptyState title="No orders yet" description="Orders from buyers will appear here." />
      ) : (
        <Card padding={0} style={{ overflow: "hidden" }}>
          {orders.map((o, i) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setOpenId(o.id)}
              className="flex w-full flex-wrap items-center justify-between gap-4 text-left"
              style={{
                padding: "16px 20px",
                background: "transparent",
                border: "none",
                borderTop: i === 0 ? "none" : "1px solid var(--line, rgba(10,10,10,.14))",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2, rgba(10,10,10,.04))")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ minWidth: 200 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700 }}>{o.product}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  {o.buyer} · {o.date}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Badge tone={STATUS_TONE[o.status]}>{o.status}</Badge>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 800, minWidth: 56, textAlign: "right" }}>
                  ${o.amount}
                </span>
              </div>
            </button>
          ))}
        </Card>
      )}

      {openId && <OrderDetailModal id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function OrderDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<OrderDetailView | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getOrder(id)
      .then((d) => alive && setDetail(d))
      .catch((e) => alive && setErr(e instanceof Error ? e.message : "Couldn't load the order."));
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(10,10,10,.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "8vh 16px",
        overflowY: "auto",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460 }}>
        <Card style={{ padding: 24 }}>
          <div className="mb-4 flex items-center justify-between">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700 }}>Order detail</span>
            <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 18, color: "var(--muted)" }}>
              ✕
            </button>
          </div>

          {err ? (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--tone-danger-fg, #b23a00)" }}>{err}</p>
          ) : !detail ? (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>Loading…</p>
          ) : (
            <>
              <Row label="Product" value={detail.product} />
              <Row label="Buyer" value={detail.buyer} />
              <Row label="Date" value={detail.date} />
              <Row label="Amount" value={`$${detail.amount.toLocaleString("en-US")}`} />
              <Row label="Status" value={detail.status} />

              {detail.settlement ? (
                <div className="mt-4">
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                    Settlement split
                  </div>
                  {detail.settlement.recipients.map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-3" style={{ padding: "7px 0", borderTop: i === 0 ? "none" : "1px solid var(--line, rgba(10,10,10,.14))" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>
                        {r.role} <span style={{ color: "var(--muted)" }}>· {r.percentage}%</span>
                        {r.type !== "PLATFORM" && r.walletAddress && (
                          <span style={{ color: "var(--muted)" }}> · {truncateAddress(r.walletAddress)}</span>
                        )}
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 700 }}>
                        ${r.amount.toLocaleString("en-US")}
                      </span>
                    </div>
                  ))}
                  <div className="mt-3">
                    <a href={detail.settlement.explorerLink} target="_blank" rel="noreferrer" style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--text)", textDecoration: "underline" }}>
                      view settlement on explorer ↗
                    </a>
                  </div>
                </div>
              ) : (
                <p className="mt-4" style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--muted)" }}>
                  Not settled yet — the split appears once payment settles on-chain.
                </p>
              )}

              <div className="mt-5 flex justify-end">
                <Button variant="primary" onClick={onClose}>Done</Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4" style={{ padding: "8px 0", borderTop: "1px solid var(--line, rgba(10,10,10,.14))" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--muted)" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 700, textAlign: "right" }}>{value}</span>
    </div>
  );
}
