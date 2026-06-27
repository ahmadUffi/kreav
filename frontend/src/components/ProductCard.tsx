"use client";
import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import type { Product } from "@/lib/mock";

interface ProductCardProps {
  product: Product;
}

/**
 * Storefront product card — accent cover tile + emoji, category badge, title,
 * creator and price. Wrapped in a Link to the product detail route.
 *
 * Styling split (per role.md): box-model (layout & spacing) → Tailwind utilities;
 * brand colours, borders, shadows and typography → inline style, co-located.
 */
export default function ProductCard({ product }: ProductCardProps) {
  return (
    <Link href={`/store/${product.id}`} className="block" style={{ textDecoration: "none", color: "inherit" }}>
      <Card hover padding={0} style={{ cursor: "pointer" }}>
        <div
          className="flex h-[150px] items-center justify-center"
          style={{ background: product.accent, borderBottom: "3px solid #0A0A0A", fontSize: 56 }}
        >
          {product.emoji}
        </div>
        <div className="p-[18px]">
          <div className="mb-2.5">
            <Badge brackets={false} style={{ fontSize: 10, padding: "5px 9px", boxShadow: "none" }}>
              {product.category}
            </Badge>
          </div>
          <div
            className="mb-1.5"
            style={{ fontFamily: "var(--font-anton)", fontSize: 20, textTransform: "uppercase", lineHeight: 1.05 }}
          >
            {product.title}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>
              {product.creator}
            </span>
            <span style={{ fontFamily: "var(--font-anton)", fontSize: 18 }}>${product.price}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
