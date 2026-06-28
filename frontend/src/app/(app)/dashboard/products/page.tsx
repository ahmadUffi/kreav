import { Card, Button, EmptyState } from "@/components/ui";
import { products } from "@/lib/mock";

export default function DashboardProductsPage() {
  // Pretend the signed-in creator owns the first four products.
  const mine = products.slice(0, 4);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h1 style={{ fontFamily: "var(--font-anton)", fontSize: "clamp(26px, 3.4vw, 38px)", lineHeight: 1.05 }}>
          Products
        </h1>
        <Button variant="primary">+ New product</Button>
      </div>

      {mine.length === 0 ? (
        <EmptyState title="No products yet" description="Publish your first digital product to start selling." actionLabel="New product" />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
          {mine.map((p) => (
            <Card key={p.id} hover padding={0} style={{ overflow: "hidden" }}>
              <div className="flex h-[100px] items-center justify-center" style={{ background: p.accent, fontSize: 40 }}>
                {p.emoji}
              </div>
              <div className="p-4">
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>{p.title}</div>
                <div className="mt-3 flex items-center justify-between">
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>{p.category}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 800 }}>${p.price}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
