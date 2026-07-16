"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge, Card, Button } from "@/components/ui";
import { getProduct } from "@/lib/api/products";
import { checkout, getOrderStatus, simulatePayment } from "@/lib/api/orders";
import { useApiQuery, useApiAction } from "@/lib/api/hooks";

type Buy = "idle" | "paying" | "pending" | "paid" | "failed";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20; // ~60s, then leave it in the pending state

const SESSION_KEY = "kreav_checkout";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const { data: product, loading, error } = useApiQuery(() => getProduct(params.id), [params.id]);
  const notFound = error?.statusCode === 404;

  const { run: runCheckout, pending: creating, error: checkoutErr } = useApiAction(checkout);
  const [buy, setBuy] = useState<Buy>("idle");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payErr, setPayErr] = useState<string | null>(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const pollsRef = useRef(0);

  // Restore checkout state from sessionStorage on mount so a page refresh
  // doesn't lose the order — the buyer can resume tracking.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { orderId: string; email: string; buy: Buy };
        if (parsed.orderId && parsed.email && parsed.buy === "pending") {
          setOrderId(parsed.orderId);
          setEmail(parsed.email);
          setBuy("pending");
        }
      }
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }, []);

  // Persist checkout state so the buyer can refresh without losing their
  // order during settlement. Cleared on terminal states.
  const persistCheckout = (state: Buy, oid: string | null, mail: string) => {
    if (state === "pending" && oid && mail) {
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ orderId: oid, email: mail, buy: state }));
      } catch { /* storage full — degrade gracefully */ }
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
  };

  // Poll the order for payment/settlement status after checkout.
  useEffect(() => {
    if (buy !== "pending" || !orderId) return;
    pollsRef.current = 0;
    const id = setInterval(async () => {
      pollsRef.current += 1;
      try {
        const order = await getOrderStatus(orderId, email.trim());
        if (order.status === "Paid") {
          setBuy("paid");
          persistCheckout("paid", orderId, email);
          clearInterval(id);
          return;
        }
        if (order.status === "Failed") {
          setBuy("failed");
          persistCheckout("failed", orderId, email);
          clearInterval(id);
          return;
        }
      } catch {
        // transient — keep polling
      }
      if (pollsRef.current >= MAX_POLLS) {
        clearInterval(id);
        setPollTimedOut(true);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [buy, orderId, email]);

  const onBuy = async () => {
    if (!product) return;
    if (!EMAIL_RE.test(email.trim())) {
      setEmailErr("Enter a valid email — your product link is sent here.");
      return;
    }
    setEmailErr(null);
    const result = await runCheckout(product.id, email.trim());
    if (result) {
      setOrderId(result.orderId);
      setBuy("paying"); // show the mock local-payment step
    }
  };

  // Demo: simulate the buyer completing a local payment (QRIS/GCash). The
  // backend runs the same confirmation path as the real PSP webhook.
  const onPay = async () => {
    if (!orderId) return;
    setPayErr(null);
    setPaying(true);
    try {
      await simulatePayment(orderId);
      setBuy("pending");
      persistCheckout("pending", orderId, email);
    } catch (e) {
      setPayErr(e instanceof Error ? e.message : "Payment couldn't be processed.");
    } finally {
      setPaying(false);
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
                Settled on Stellar and the creator was paid in USDC. We&apos;ve emailed your product
                link to <span style={{ color: "var(--text)" }}>{email}</span>. Order{" "}
                <span style={{ color: "var(--text)" }}>{orderId}</span>.
              </p>
              <p style={{ margin: "8px 0 0", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>
                Haven&apos;t received it? Check your spam folder.
              </p>
            </Card>
          ) : buy === "paying" ? (
            <Card style={{ padding: 18 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                Pay with your local method
              </div>
              <p style={{ margin: "0 0 14px", fontFamily: "var(--font-mono)", fontSize: 12.5, lineHeight: 1.6, color: "var(--muted)" }}>
                Choose how you&apos;d pay (demo — no real charge). The creator receives USDC on Stellar
                the moment it clears.
              </p>
              <div className="mb-4 flex flex-wrap gap-2">
                {["QRIS", "GCash", "GoPay", "Maya"].map((m) => (
                  <Badge key={m} tone="neutral">{m}</Badge>
                ))}
              </div>
              <Button variant="primary" fullWidth disabled={paying} onClick={onPay}>
                {paying ? "Processing payment…" : `Pay $${p.price} (demo)`}
              </Button>
              {payErr && (
                <p className="mt-3" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--tone-danger-fg, #b23a00)" }}>
                  {payErr}
                </p>
              )}
            </Card>
          ) : buy === "pending" ? (
            <Card style={{ padding: 18 }}>
              {pollTimedOut ? (
                <>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--muted)" }}>
                    Taking longer than expected
                  </div>
                  <p style={{ margin: "6px 0 0", fontFamily: "var(--font-mono)", fontSize: 12.5, lineHeight: 1.6, color: "var(--muted)" }}>
                    The transaction may still be processing on Stellar. You can close this
                    page and check back later.
                  </p>
                  <p style={{ margin: "6px 0 0", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>
                    Order: <span style={{ color: "var(--text)" }}>{orderId}</span>
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2" style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700 }}>
                    <span className="kv-blink">⏳</span> Settling on Stellar…
                  </div>
                  <p style={{ margin: "6px 0 0", fontFamily: "var(--font-mono)", fontSize: 12.5, lineHeight: 1.6, color: "var(--muted)" }}>
                    Payment confirmed for order <span style={{ color: "var(--text)" }}>{orderId}</span>.
                    Splitting revenue to the creator on-chain — this page updates automatically.
                  </p>
                </>
              )}
            </Card>
          ) : buy === "failed" ? (
            <Card style={{ padding: 18, background: "var(--tone-danger-bg, rgba(255,77,0,.14))" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--tone-danger-fg, #b23a00)" }}>
                Payment failed
              </div>
              <p style={{ margin: "6px 0 12px", fontFamily: "var(--font-mono)", fontSize: 12.5, lineHeight: 1.6, color: "var(--muted)" }}>
                Order <span style={{ color: "var(--text)" }}>{orderId}</span> didn&apos;t go through.
              </p>
              <Button variant="primary" onClick={() => { setBuy("idle"); persistCheckout("idle", null, ""); }}>
                Try again
              </Button>
            </Card>
          ) : (
            <>
              <label
                htmlFor="buyer-email"
                style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, marginBottom: 7 }}
              >
                Email for your product link
              </label>
              <input
                id="buyer-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mb-3"
                style={{
                  width: "100%",
                  fontFamily: "var(--font-mono)",
                  fontSize: 14,
                  padding: "12px 14px",
                  borderRadius: "var(--r-sm, 8px)",
                  border: "1.5px solid var(--line, rgba(10,10,10,.14))",
                  background: "var(--card)",
                  color: "var(--card-text)",
                }}
              />
              <Button variant="primary" fullWidth disabled={creating} onClick={onBuy}>
                {creating ? "Starting checkout…" : `Buy now — $${p.price}`}
              </Button>
              {emailErr && (
                <p className="mt-3" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--tone-danger-fg, #b23a00)" }}>
                  {emailErr}
                </p>
              )}
              {checkoutErr && (
                <p className="mt-3" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--tone-danger-fg, #b23a00)" }}>
                  {checkoutErr.message}
                </p>
              )}
              <p className="mt-3" style={{ fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.6, color: "var(--muted)" }}>
                Pay with a local method (QRIS/e-wallet). The creator receives USDC on Stellar in
                seconds, and your download link is emailed once it settles.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
