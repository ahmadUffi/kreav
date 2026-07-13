"use client";
import { useMemo, useState } from "react";
import ProductCard from "@/components/ProductCard";
import { Badge, Button, Input } from "@/components/ui";
import type { Product } from "@/lib/types";

const PAGE_SIZE = 12;

/**
 * Client-side storefront browser: search (title/creator) + category filter +
 * pagination over the products the server already fetched. Category is derived
 * client-side (in the mapper), so filtering happens in JS — no API round-trip.
 */
export default function StoreBrowser({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category))].sort(),
    [products],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (category && p.category !== category) return false;
      if (q && !`${p.title} ${p.creator}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, query, category]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const reset = () => setPage(1);

  return (
    <section className="mb-20">
      <h2 className="mb-6" style={{ fontFamily: "var(--font-anton)", fontSize: "clamp(24px, 3vw, 36px)", lineHeight: 1.05 }}>
        All products
      </h2>

      {/* Controls */}
      <div className="mb-6 flex flex-col gap-4">
        <div style={{ maxWidth: 360 }}>
          <Input
            id="store-search"
            placeholder="Search products or creators…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              reset();
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <CategoryChip label="All" active={category === null} onClick={() => { setCategory(null); reset(); }} />
          {categories.map((c) => (
            <CategoryChip key={c} label={c} active={category === c} onClick={() => { setCategory(c); reset(); }} />
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>
          No products match your search.
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
          {shown.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <Button variant="secondary" disabled={current <= 1} onClick={() => setPage(current - 1)}>
            ← Prev
          </Button>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>
            Page {current} / {totalPages}
          </span>
          <Button variant="secondary" disabled={current >= totalPages} onClick={() => setPage(current + 1)}>
            Next →
          </Button>
        </div>
      )}
    </section>
  );
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
      <Badge tone={active ? "accent" : "neutral"}>{label}</Badge>
    </button>
  );
}
