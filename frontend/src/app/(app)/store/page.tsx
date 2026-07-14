import Link from "next/link";
import { Badge, Button, Card } from "@/components/ui";
import ProductCard from "@/components/ProductCard";
import StoreBrowser from "@/components/StoreBrowser";
import { listProducts } from "@/lib/api/products";
import { ApiError } from "@/lib/api/client";
import type { Product } from "@/lib/types";

// Render per-request (not baked at build) so the storefront always reflects the
// live DB. Without this the page is statically prerendered at build time — if the
// API is unreachable / DB empty during build, `/store` bakes in an empty list and
// never re-fetches at runtime (every other page is client/dynamic, so they work).
export const dynamic = "force-dynamic";

/**
 * Storefront landing (server component) — introduces the ready-to-buy products
 * and the creators behind them, sourced from `GET /products`. The backend has no
 * "list creators" endpoint, so the creators section is derived from the product
 * list (grouped by creator name).
 */
export default async function StorePage() {
  let products: Product[] = [];
  let loadError: string | null = null;

  try {
    const res = await listProducts({ limit: 60 });
    products = res.items;
  } catch (e) {
    loadError = e instanceof ApiError ? e.message : "Couldn't load the store right now.";
  }

  // Derive unique creators from the product list.
  const creatorMap = new Map<string, { handle: string; accent: string; count: number }>();
  for (const p of products) {
    const existing = creatorMap.get(p.creator);
    if (existing) existing.count += 1;
    else creatorMap.set(p.creator, { handle: p.creator, accent: p.accent, count: 1 });
  }
  const creators = [...creatorMap.values()];
  const featured = products.slice(0, 3);

  return (
    <div className="mx-auto max-w-[1280px] px-6 pt-12 pb-[90px] sm:px-10">
      {/* Intro hero */}
      <section className="mb-14">
        <Badge>Storefront</Badge>
        <h1
          className="mt-4 mb-3 max-w-[820px]"
          style={{ fontFamily: "var(--font-anton)", fontSize: "clamp(34px, 5.2vw, 64px)", lineHeight: 1.02 }}
        >
          Digital products by Asian creators — ready to buy.
        </h1>
        <p
          className="mb-7 max-w-[560px]"
          style={{ fontFamily: "var(--font-mono)", fontSize: 15, lineHeight: 1.65, color: "var(--muted)" }}
        >
          Presets, templates, ebooks, courses and music — made by independent
          creators across the region. Pay instantly in your own currency;
          settlement is powered by Stellar.
        </p>

        <div className="flex flex-wrap gap-3">
          <a href="#products" style={{ textDecoration: "none" }}>
            <Button variant="primary">Browse products</Button>
          </a>
          <a href="#creators" style={{ textDecoration: "none" }}>
            <Button variant="secondary">Meet the creators</Button>
          </a>
        </div>

        {/* Trust strip */}
        <div className="mt-9 flex flex-wrap gap-x-8 gap-y-2">
          {[
            [`${products.length}`, "products live"],
            [`${creators.length}`, "creators"],
            ["5+", "countries"],
            ["Instant", "delivery"],
          ].map(([n, label]) => (
            <div key={label} className="flex items-baseline gap-2">
              <span style={{ fontFamily: "var(--font-anton)", fontSize: 24 }}>{n}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {loadError ? (
        <Card className="text-center" style={{ padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🛠️</div>
          <div className="mb-1" style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700 }}>
            Store unavailable
          </div>
          <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>
            {loadError}
          </p>
        </Card>
      ) : products.length === 0 ? (
        <Card className="text-center" style={{ padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🗂️</div>
          <div className="mb-1" style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700 }}>
            No products yet
          </div>
          <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>
            Be the first to launch a product on Kreav.
          </p>
        </Card>
      ) : (
        <>
          {/* Featured products */}
          <section id="products" className="mb-16 scroll-mt-20">
            <div className="mb-6">
              <Badge tone="neutral">Featured</Badge>
              <h2 className="mt-3" style={{ fontFamily: "var(--font-anton)", fontSize: "clamp(24px, 3vw, 36px)", lineHeight: 1.05 }}>
                Fresh drops
              </h2>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
              {featured.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>

          {/* All products — search / category filter / pagination (client) */}
          <StoreBrowser products={products} />

          {/* Meet the creators */}
          <section id="creators" className="mb-20 scroll-mt-20">
            <Badge tone="neutral">On Kreav</Badge>
            <h2 className="mt-3 mb-2" style={{ fontFamily: "var(--font-anton)", fontSize: "clamp(24px, 3vw, 36px)", lineHeight: 1.05 }}>
              Meet the creators
            </h2>
            <p className="mb-7 max-w-[520px]" style={{ fontFamily: "var(--font-mono)", fontSize: 14, lineHeight: 1.6, color: "var(--muted)" }}>
              The independent makers behind the products.
            </p>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
              {creators.map((c) => (
                <Card key={c.handle} style={{ height: "100%" }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="flex items-center justify-center"
                      style={{
                        width: 48,
                        height: 48,
                        flexShrink: 0,
                        borderRadius: "var(--r-sm, 8px)",
                        background: c.accent,
                        fontFamily: "var(--font-anton)",
                        fontSize: 22,
                        color: "#0A0A0A",
                      }}
                    >
                      {c.handle.replace(/^@/, "").charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {c.handle}
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>
                        {c.count} {c.count === 1 ? "product" : "products"}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}

      {/* Sell CTA band */}
      <section>
        <Card
          className="flex flex-col items-center gap-5 text-center sm:flex-row sm:justify-between sm:text-left"
          style={{ padding: 32 }}
        >
          <div>
            <h2 style={{ fontFamily: "var(--font-anton)", fontSize: "clamp(22px, 2.6vw, 32px)", lineHeight: 1.05 }}>
              Have something to sell?
            </h2>
            <p className="mt-2 max-w-[420px]" style={{ fontFamily: "var(--font-mono)", fontSize: 13.5, lineHeight: 1.6, color: "var(--muted)" }}>
              Launch your own storefront in minutes and get paid instantly, in
              any currency.
            </p>
          </div>
          <Link href="/signup" style={{ textDecoration: "none", flexShrink: 0 }}>
            <Button variant="primary">Start selling</Button>
          </Link>
        </Card>
      </section>
    </div>
  );
}
