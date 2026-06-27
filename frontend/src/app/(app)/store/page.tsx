"use client";
import { useState } from "react";
import { Badge, Card, Button, Skeleton, EmptyState } from "@/components/ui";
import { products } from "@/lib/mock";

type View = "live" | "loading" | "empty";

export default function StorePage() {
  const [view, setView] = useState<View>("live");

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "60px 40px 90px" }}>
      <Badge>Storefront</Badge>
      <h1
        style={{
          fontFamily: "var(--font-anton)",
          fontSize: "clamp(34px, 5vw, 64px)",
          textTransform: "uppercase",
          lineHeight: 1,
          margin: "20px 0 10px",
        }}
      >
        Digital products by Asian creators
      </h1>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 15,
          color: "var(--muted)",
          maxWidth: 560,
          margin: "0 0 30px",
        }}
      >
        Browse presets, templates, ebooks and more. Pay instantly in your own
        currency — settlement powered by Stellar.
      </p>

      {/* Demo state switcher (FE-001 shell only — no real fetching yet). */}
      <div style={{ display: "flex", gap: 10, marginBottom: 30, flexWrap: "wrap" }}>
        {(["live", "loading", "empty"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
              padding: "7px 12px",
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
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 24,
          }}
        >
          {view === "loading"
            ? Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} padding={0}>
                  <Skeleton height={150} />
                  <div style={{ padding: 18 }}>
                    <Skeleton height={16} style={{ marginBottom: 10 }} />
                    <Skeleton height={12} width="60%" />
                  </div>
                </Card>
              ))
            : products.map((p) => (
                <Card key={p.id} hover padding={0} style={{ cursor: "pointer" }}>
                  <div
                    style={{
                      height: 150,
                      background: p.accent,
                      borderBottom: "3px solid #0A0A0A",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 56,
                    }}
                  >
                    {p.emoji}
                  </div>
                  <div style={{ padding: 18 }}>
                    <div style={{ marginBottom: 10 }}>
                      <Badge brackets={false} style={{ fontSize: 10, padding: "5px 9px", boxShadow: "none" }}>
                        {p.category}
                      </Badge>
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-anton)",
                        fontSize: 20,
                        textTransform: "uppercase",
                        lineHeight: 1.05,
                        marginBottom: 6,
                      }}
                    >
                      {p.title}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: 12,
                      }}
                    >
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>
                        {p.creator}
                      </span>
                      <span style={{ fontFamily: "var(--font-anton)", fontSize: 18 }}>${p.price}</span>
                    </div>
                  </div>
                </Card>
              ))}
        </div>
      )}

      <div style={{ marginTop: 40 }}>
        <Button variant="section">Load more</Button>
      </div>
    </div>
  );
}
