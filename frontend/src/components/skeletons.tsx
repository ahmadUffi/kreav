"use client";
import { Card } from "@/components/ui";
import Skeleton from "@/components/ui/Skeleton";

/**
 * Layout-matched loading skeletons for the dashboard. Each mirrors the shape of
 * the content it stands in for, so the page doesn't jump when data arrives.
 * All bars pulse via the shared `kv-skeleton` keyframe (see Skeleton).
 */

/** A card-shaped stat placeholder (label · value · sparkline). */
function StatCardSkeleton() {
  return (
    <Card style={{ padding: 18 }}>
      <Skeleton width={90} height={11} />
      <Skeleton width={120} height={26} style={{ marginTop: 12 }} />
      <Skeleton width="100%" height={28} style={{ marginTop: 14, opacity: 0.14 }} />
    </Card>
  );
}

/** Overview: 4 KPIs + 2 charts + a recent-orders list. */
export function DashboardOverviewSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card style={{ padding: 20 }} className="lg:col-span-2">
          <Skeleton width={110} height={14} />
          <Skeleton width="100%" height={180} style={{ marginTop: 16, opacity: 0.14 }} />
        </Card>
        <Card style={{ padding: 20 }}>
          <Skeleton width={110} height={14} />
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} width={`${90 - i * 15}%`} height={16} />
            ))}
          </div>
        </Card>
      </div>
      <Card padding={0} style={{ marginTop: 16, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--line, rgba(10,10,10,.14))" }}>
          <Skeleton width={130} height={14} />
        </div>
        <ListRowsSkeleton rows={4} />
      </Card>
    </>
  );
}

/** Generic two-line + trailing-amount rows (orders, recent orders, transactions). */
export function ListRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-4"
          style={{ padding: "16px 20px", borderTop: i === 0 ? "none" : "1px solid var(--line, rgba(10,10,10,.14))" }}
        >
          <div style={{ flex: 1, maxWidth: 260 }}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="40%" height={11} style={{ marginTop: 8 }} />
          </div>
          <Skeleton width={64} height={18} />
        </div>
      ))}
    </>
  );
}

/** Orders page: a single card of list rows. */
export function OrderListSkeleton() {
  return (
    <Card padding={0} style={{ overflow: "hidden" }}>
      <ListRowsSkeleton rows={6} />
    </Card>
  );
}

/** Products page: responsive grid of image-topped cards. */
export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} padding={0} style={{ overflow: "hidden" }}>
          <Skeleton width="100%" height={100} style={{ borderRadius: 0 }} />
          <div className="p-4">
            <Skeleton width="80%" height={15} />
            <div className="mt-3 flex items-center justify-between">
              <Skeleton width={60} height={12} />
              <Skeleton width={40} height={15} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

/** Wallet page: balance card + transactions list. */
export function WalletSkeleton() {
  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(220px,320px)_1fr]">
      <Card style={{ padding: 24 }}>
        <Skeleton width={110} height={11} />
        <Skeleton width={150} height={40} style={{ marginTop: 12 }} />
        <Skeleton width={80} height={12} style={{ marginTop: 8 }} />
        <Skeleton width="100%" height={40} style={{ marginTop: 20 }} />
      </Card>
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--line, rgba(10,10,10,.14))" }}>
          <Skeleton width={140} height={14} />
        </div>
        <ListRowsSkeleton rows={5} />
      </Card>
    </div>
  );
}

/** Bare label + field rows (no card wrapper) — for use inside an existing card. */
export function FormFieldsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i}>
          <Skeleton width={100} height={12} />
          <Skeleton width="100%" height={42} style={{ marginTop: 8 }} bordered />
        </div>
      ))}
    </div>
  );
}

/** Settings / mini-site: a card of label + field rows. */
export function FormSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card style={{ padding: 24 }}>
      <FormFieldsSkeleton rows={rows} />
    </Card>
  );
}
