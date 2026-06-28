import { Card, Badge } from "@/components/ui";
import StatCard from "@/components/ui/StatCard";
import AreaChart from "@/components/charts/AreaChart";
import BarChart, { type BarItem } from "@/components/charts/BarChart";
import { analytics, orders, products } from "@/lib/mock";

const productTitle = (id: string) => products.find((p) => p.id === id)?.title ?? id;

export default function DashboardOverviewPage() {
  const revenue = analytics.revenueSeries.map((p) => p.amount);
  const topItems: BarItem[] = analytics.topProducts.map((t) => ({
    label: productTitle(t.productId),
    value: t.revenue,
    sub: `${t.sales} sales`,
  }));
  const recent = orders.slice(0, 5);

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-anton)", fontSize: "clamp(26px, 3.4vw, 38px)", lineHeight: 1.05 }}>
        Overview
      </h1>
      <p className="mt-1 mb-6" style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>
        Last 30 days · all figures are demo data.
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total revenue" value={`$${analytics.totals.revenueUsd.toLocaleString("en-US")}`} delta={analytics.deltas.revenue} icon="trend" spark={revenue} />
        <StatCard label="Sales" value={analytics.totals.sales.toLocaleString("en-US")} delta={analytics.deltas.sales} icon="orders" spark={revenue} />
        <StatCard label="Active products" value={String(analytics.totals.activeProducts)} delta={analytics.deltas.products} icon="products" />
        <StatCard label="Pending payout" value={`$${analytics.totals.pendingPayout.toLocaleString("en-US")}`} delta={analytics.deltas.payout} icon="wallet" />
      </div>

      {/* Charts */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card style={{ padding: 20 }} className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700 }}>Revenue</span>
            <Badge tone="neutral">30 days</Badge>
          </div>
          <AreaChart data={revenue} />
        </Card>
        <Card style={{ padding: 20 }}>
          <div className="mb-4" style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700 }}>
            Top products
          </div>
          <BarChart items={topItems} format={(v) => `$${v.toLocaleString("en-US")}`} />
        </Card>
      </div>

      {/* Recent orders */}
      <Card padding={0} style={{ marginTop: 16, overflow: "hidden" }}>
        <div
          className="flex items-center justify-between"
          style={{ padding: "14px 20px", borderBottom: "1px solid var(--line, rgba(10,10,10,.14))" }}
        >
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700 }}>Recent orders</span>
          <a href="/dashboard/orders" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", textDecoration: "none" }}>
            View all →
          </a>
        </div>
        {recent.map((o, i) => (
          <div
            key={o.id}
            className="flex flex-wrap items-center justify-between gap-3"
            style={{ padding: "13px 20px", borderTop: i === 0 ? "none" : "1px solid var(--line, rgba(10,10,10,.14))" }}
          >
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700 }}>{o.product}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                {o.buyer} · {o.date}
              </div>
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 800 }}>${o.amount}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
