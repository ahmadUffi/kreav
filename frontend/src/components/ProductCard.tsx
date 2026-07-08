"use client";
import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import type { Product } from "@/lib/types";

interface ProductCardProps {
  product: Product;
}

/**
 * Storefront product card — coloured cover tile + emoji, category chip, title,
 * creator and price. Wrapped in a Link to the product detail route.
 */
export default function ProductCard({ product }: ProductCardProps) {
  return (
    <Link href={`/store/${product.id}`} className="block" style={{ textDecoration: "none", color: "inherit" }}>
      <Card hover padding={0} style={{ cursor: "pointer", overflow: "hidden" }}>
        <div
          className="flex h-[140px] items-center justify-center"
          style={{ background: product.accent, fontSize: 52 }}
        >
          {product.emoji}
        </div>
        <div className="p-4">
          <div className="mb-2">
            <Badge tone="neutral">{product.category}</Badge>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>
            {product.title}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>
              {product.creator}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 800 }}>
              ${product.price}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
