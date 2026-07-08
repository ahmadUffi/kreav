"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge, Card, Button } from "@/components/ui";
import { getProduct } from "@/lib/api/products";
import { checkout, getOrder } from "@/lib/api/orders";
import { useApiQuery, useApiAction } from "@/lib/api/hooks";

type Buy = "idle" | "pending" | "paid" | "failed";

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20; // ~60s, then leave it in the pending state

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const { data: product, loading, error } = useApiQuery(() => getProduct(params.id), [params.id]);
  const notFound = error?.statusCode === 404;

  const { run: runCheckout, pending: creating, error: checkoutErr } = useApiAction(checkout);
  const [buy, setBuy] = useState<Buy>("idle");
  const [orderId, setOrderId] = useState<string | null>(null);
  const pollsRef = useRef(0);

  // Poll the order for payment/settlement status after checkout.
  useEffect(() => {
    if (buy !== "pending" || !orderId) return;
    pollsRef.current = 0;
    const id = setInterval(async () => {
      pollsRef.current += 1;
      try {
        const order = await getOrder(orderId);
        if (order.status === "Paid") {
          setBuy("paid");
          clearInterval(id);
          return;
        }
        if (order.status === "Failed") {
          setBuy("failed");
          clearInterval(id);
          return;
        }
      } catch {
        // transient — keep polling
      }
      if (pollsRef.current >= MAX_POLLS) clearInterval(id);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [buy, orderId]);

  const onBuy = async () => {
    if (!product) return;
    const oid = await runCheckout(product.id);
    if (oid) {
      setOrderId(oid);
      setBuy("pending");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[960px] px-10 pt-12 pb-[90px]">
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>Loading…</div>
      </div>
    );
  }

  if (notFound || (!product && !error)) {
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

  if (error && !product) {
    return (
      <div className="mx-auto max-w-[680px] px-10 pt-12 pb-[90px]">
        <Card className="text-center" style={{ padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🛠️</div>
          <div className="mb-1" style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700 }}>
            Couldn&apos;t load product
          </div>
          <p style={{ margin: "0 0 16px", fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>{error.message}</p>
          <Button variant="primary" onClick={() => router.push("/store")}>
            Back to store
          </Button>
        </Card>
      </div>
    );
  }

  const p = product!;

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
            background: p.accent,
            borderRadius: "var(--r, 10px)",
            boxShadow: "var(--shadow, 0 6px 20px rgba(10,10,10,.08))",
            fontSize: 120,
          }}
        >
          {p.emoji}
        </div>

        {/* Info */}
        <div>
          <Badge tone="neutral">{p.category}</Badge>
          <h1
            className="mt-4 mb-2"
            style={{ fontFamily: "var(--font-anton)", fontSize: "clamp(28px, 4vw, 46px)", lineHeight: 1.05 }}
          >
            {p.title}
          </h1>
          <div className="mb-5" style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--muted)" }}>
            by {p.creator}
          </div>

          <p className="mb-7 max-w-[520px]" style={{ fontFamily: "var(--font-mono)", fontSize: 14, lineHeight: 1.7 }}>
            {p.description ?? "No description available for this product yet."}
          </p>

          <div className="mb-5 flex items-baseline gap-2">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 30, fontWeight: 800, lineHeight: 1 }}>
              ${p.price}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>USD</span>
          </div>

          {/* Buy / checkout states */}
          {buy === "paid" ? (
            <Card style={{ padding: 18, background: "var(--tone-success-bg, rgba(2,158,87,.14))" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--tone-success-fg, #0a7a45)" }}>
                ✓ Payment received
              </div>
              <p style={{ margin: "6px 0 0", fontFamily: "var(--font-mono)", fontSize: 12.5, lineHeight: 1.6, color: "var(--muted)" }}>
                Your order is confirmed and settling on Stellar. Order{" "}
                <span style={{ color: "var(--text)" }}>{orderId}</span>.
              </p>
            </Card>
          ) : buy === "pending" ? (
            <Card style={{ padding: 18 }}>
              <div className="flex items-center gap-2" style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700 }}>
                <span className="kv-blink">⏳</span> Waiting for payment…
              </div>
              <p style={{ margin: "6px 0 0", fontFamily: "var(--font-mono)", fontSize: 12.5, lineHeight: 1.6, color: "var(--muted)" }}>
                Order <span style={{ color: "var(--text)" }}>{orderId}</span> is created. Complete the
                payment with your provider — this page updates automatically once it lands.
              </p>
            </Card>
          ) : buy === "failed" ? (
            <Card style={{ padding: 18, background: "var(--tone-danger-bg, rgba(255,77,0,.14))" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--tone-danger-fg, #b23a00)" }}>
                Payment failed
              </div>
              <p style={{ margin: "6px 0 12px", fontFamily: "var(--font-mono)", fontSize: 12.5, lineHeight: 1.6, color: "var(--muted)" }}>
                Order <span style={{ color: "var(--text)" }}>{orderId}</span> didn&apos;t go through.
              </p>
              <Button variant="primary" onClick={onBuy}>
                Try again
              </Button>
            </Card>
          ) : (
            <>
              <Button variant="primary" fullWidth disabled={creating} onClick={onBuy}>
                {creating ? "Starting checkout…" : `Buy now — $${p.price}`}
              </Button>
              {checkoutErr && (
                <p className="mt-3" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--tone-danger-fg, #b23a00)" }}>
                  {checkoutErr.message}
                </p>
              )}
              <p className="mt-3" style={{ fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.6, color: "var(--muted)" }}>
                Checkout creates an order and waits for your payment. Settlement to the creator runs
                on Stellar. <span style={{ color: "var(--text)" }}>Demo: payment is confirmed by a server-side webhook.</span>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
