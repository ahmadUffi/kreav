"use client";
import { Badge, Button } from "@/components/ui";
import ProductCard from "@/components/ProductCard";
import { products } from "@/lib/mock";

export default function StorePage() {
  return (
    <div className="mx-auto max-w-[1280px] px-10 pt-12 pb-[90px]">
      <Badge>Storefront</Badge>
      <h1
        className="mt-4 mb-2"
        style={{ fontFamily: "var(--font-anton)", fontSize: "clamp(30px, 4.4vw, 52px)", lineHeight: 1.05 }}
      >
        Digital products by Asian creators
      </h1>
      <p
        className="mb-9 max-w-[560px]"
        style={{ fontFamily: "var(--font-mono)", fontSize: 14, lineHeight: 1.6, color: "var(--muted)" }}
      >
        Browse presets, templates, ebooks and more. Pay instantly in your own
        currency — settlement powered by Stellar.
      </p>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>

      <div className="mt-10 flex justify-center">
        <Button variant="secondary">Load more</Button>
      </div>
    </div>
  );
}
