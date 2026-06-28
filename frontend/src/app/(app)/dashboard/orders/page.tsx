import { Card, Badge, EmptyState } from "@/components/ui";
import { orders } from "@/lib/mock";

type Tone = "success" | "warn" | "danger";
const STATUS_TONE: Record<string, Tone> = {
  Paid: "success",
  Pending: "warn",
  Refunded: "danger",
};

export default function DashboardOrdersPage() {
  return (
    <div>
      <h1 className="mb-5" style={{ fontFamily: "var(--font-anton)", fontSize: "clamp(26px, 3.4vw, 38px)", lineHeight: 1.05 }}>
        Orders
      </h1>

      {orders.length === 0 ? (
        <EmptyState title="No orders yet" description="Orders from buyers will appear here." />
      ) : (
        <Card padding={0} style={{ overflow: "hidden" }}>
          {orders.map((o, i) => (
            <div
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-4"
              style={{ padding: "16px 20px", borderTop: i === 0 ? "none" : "1px solid var(--line, rgba(10,10,10,.14))" }}
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
      )}
    </div>
  );
}
