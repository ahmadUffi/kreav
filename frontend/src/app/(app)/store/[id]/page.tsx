"use client";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Card, Button } from "@/components/ui";
import { products } from "@/lib/mock";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const product = products.find((p) => p.id === params.id);

  if (!product) {
    return (
      <div className="mx-auto max-w-[680px] px-10 pt-12 pb-[90px]">
        <Card className="flex flex-col items-center text-center" style={{ padding: 48 }}>
          <div style={{ fontSize: 46, marginBottom: 12 }}>🛒</div>
          <div className="mb-2" style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700 }}>
            Product not found
          </div>
          <p
            className="mb-6 max-w-[380px]"
            style={{ fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.6, color: "var(--muted)" }}
          >
            We couldn&apos;t find the product <span style={{ color: "var(--text)" }}>{params.id}</span>.
            It may have been removed or the link is wrong.
          </p>
          <Button variant="primary" onClick={() => router.push("/store")}>
            Back to store
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[960px] px-10 pt-12 pb-[90px]">
      <Link
        href="/store"
        className="mb-6 inline-block"
        style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)", textDecoration: "none" }}
      >
        ← Back to store
      </Link>

      <div className="grid items-start gap-8 md:grid-cols-[minmax(0,420px)_1fr]">
        {/* Cover tile */}
        <div
          className="flex items-center justify-center"
          style={{
            aspectRatio: "1 / 1",
            background: product.accent,
            borderRadius: "var(--r, 10px)",
            boxShadow: "var(--shadow, 0 6px 20px rgba(10,10,10,.08))",
            fontSize: 120,
          }}
        >
          {product.emoji}
        </div>

        {/* Info */}
        <div>
          <Badge tone="neutral">{product.category}</Badge>
          <h1
            className="mt-4 mb-2"
            style={{ fontFamily: "var(--font-anton)", fontSize: "clamp(28px, 4vw, 46px)", lineHeight: 1.05 }}
          >
            {product.title}
          </h1>
          <div className="mb-5" style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--muted)" }}>
            by {product.creator}
          </div>

          <p className="mb-7 max-w-[520px]" style={{ fontFamily: "var(--font-mono)", fontSize: 14, lineHeight: 1.7 }}>
            {product.description ?? "No description available for this product yet."}
          </p>

          <div className="mb-5 flex items-baseline gap-2">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 30, fontWeight: 800, lineHeight: 1 }}>
              ${product.price}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>USD</span>
          </div>

          <Button variant="primary" fullWidth>
            Buy now — ${product.price}
          </Button>
          <p className="mt-3" style={{ fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.6, color: "var(--muted)" }}>
            You&apos;ll be taken to a secure payment step to complete your purchase.{" "}
            <span style={{ color: "var(--text)" }}>Demo only — no charge is made yet.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
