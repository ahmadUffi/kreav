"use client";
import { useState } from "react";
import { Badge, Card, Button, Skeleton, EmptyState, ErrorState } from "@/components/ui";
import ProductCard from "@/components/ProductCard";
import { products } from "@/lib/mock";

type View = "live" | "loading" | "empty" | "error";

export default function StorePage() {
  const [view, setView] = useState<View>("live");

  return (
    <div className="mx-auto max-w-[1280px] px-10 pt-15 pb-[90px]">
      <Badge>Storefront</Badge>
      <h1
        className="mt-5 mb-2.5"
        style={{
          fontFamily: "var(--font-anton)",
          fontSize: "clamp(34px, 5vw, 64px)",
          textTransform: "uppercase",
          lineHeight: 1,
        }}
      >
        Digital products by Asian creators
      </h1>
      <p
        className="mb-[30px] max-w-[560px]"
        style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--muted)" }}
      >
        Browse presets, templates, ebooks and more. Pay instantly in your own
        currency — settlement powered by Stellar.
      </p>

      {/* Demo state switcher (UI shell only — no real fetching yet). */}
      <div className="mb-[30px] flex flex-wrap gap-2.5">
        {(["live", "loading", "empty", "error"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="px-3 py-[7px]"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
              cursor: "pointer",
              background: view === v ? "#FFE600" : "transparent",
              color: view === v ? "#0A0A0A" : "var(--text)",
              border: "2px solid #0A0A0A",
            }}
          >
            {v}
          </button>
        ))}
      </div>

      {view === "empty" ? (
        <EmptyState
          title="No products yet"
          description="Once creators publish their work it will show up here."
          actionLabel="Become a creator"
          onAction={() => setView("live")}
        />
      ) : view === "error" ? (
        <ErrorState
          title="Couldn't load products"
          description="Something went wrong while fetching the storefront. Please try again."
          retryLabel="Retry"
          onRetry={() => setView("live")}
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-6">
          {view === "loading"
            ? Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} padding={0}>
                  <Skeleton height={150} />
                  <div className="p-[18px]">
                    <Skeleton height={16} style={{ marginBottom: 10 }} />
                    <Skeleton height={12} width="60%" />
                  </div>
                </Card>
              ))
            : products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}

      <div className="mt-10">
        <Button variant="section">Load more</Button>
      </div>
    </div>
  );
}
