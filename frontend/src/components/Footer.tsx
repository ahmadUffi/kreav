"use client";
import { useRef } from "react";

const COLS = [
  { title: "Product", links: ["How It Works", "For Creators", "Pricing"] },
  { title: "Company", links: ["About", "Blog", "Careers"] },
  { title: "Connect", links: ["Twitter", "Instagram", "Discord"] },
];

export default function Footer() {
  const logoRRef = useRef<HTMLSpanElement>(null);
  const logoCRef = useRef<HTMLSpanElement>(null);

  const doGlitch = () => {
    import("gsap").then(({ gsap }) => {
      const r = logoRRef.current;
      const c = logoCRef.current;
      if (!r || !c) return;
      gsap.set([r, c], { opacity: 1 });
      const tl = gsap.timeline({ onComplete: () => gsap.set([r, c], { opacity: 0, x: 0 }) });
      for (let i = 0; i < 6; i++) {
        tl.set(r, { x: Math.random() * 6 - 3 });
        tl.set(c, { x: Math.random() * 6 - 3 });
        tl.to({}, { duration: 0.05 });
      }
    });
  };

  return (
    <footer
      id="pricing"
      style={{
        position: "relative",
        background: "var(--bg)",
        borderTop: "4px solid #0A0A0A",
        padding: "70px 40px 34px",
        overflow: "hidden",
      }}
    >
      {/* Ghost KREAV text */}
      <div
        aria-hidden
        style={{
          fontFamily: "var(--font-anton)",
          fontSize: "clamp(90px,20vw,300px)",
          lineHeight: 0.8,
          color: "var(--text)",
          opacity: 0.04,
          position: "absolute",
          bottom: -12,
          left: 20,
          pointerEvents: "none",
          userSelect: "none",
          letterSpacing: -2,
        }}
      >
        KREAV
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr 1fr 1fr",
          gap: 30,
          maxWidth: 1280,
          margin: "0 auto 46px",
        }}
      >
        {/* Brand */}
        <div>
          <div
            onMouseEnter={doGlitch}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              marginBottom: 14,
              position: "relative",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 12 12">
              <rect x="4" y="4" width="4" height="4" fill="#FFE600" stroke="#0A0A0A" strokeWidth="1" />
            </svg>
            <span style={{ fontFamily: "var(--font-anton)", fontSize: 24, color: "var(--text)", position: "relative" }}>
              KREAV
              <span
                ref={logoRRef}
                aria-hidden
                style={{ position: "absolute", left: 0, top: 0, color: "#FF3BFF", clipPath: "inset(0 0 50% 0)", opacity: 0 }}
              >
                KREAV
              </span>
              <span
                ref={logoCRef}
                aria-hidden
                style={{ position: "absolute", left: 0, top: 0, color: "#00F5FF", clipPath: "inset(50% 0 0 0)", opacity: 0 }}
              >
                KREAV
              </span>
            </span>
          </div>
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--muted)",
              maxWidth: 280,
              margin: 0,
              fontFamily: "var(--font-mono)",
            }}
          >
            Sell your ebooks, presets, and templates to buyers across Asia. Get paid instantly, in your own currency.
          </p>
        </div>

        {/* Link columns */}
        {COLS.map((col) => (
          <div key={col.title}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "var(--text)",
                marginBottom: 14,
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
              }}
            >
              {col.title}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
              {col.links.map((link) => (
                <span
                  key={link}
                  style={{ cursor: "pointer", transition: "color 0.15s" }}
                  onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "var(--text)")}
                  onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "var(--muted)")}
                >
                  {link}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          borderTop: "2px solid #0A0A0A",
          paddingTop: 20,
          maxWidth: 1280,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 14,
          fontSize: 11,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: "var(--muted)",
          fontFamily: "var(--font-mono)",
        }}
      >
        <div>kreav.com — Sell your digital work across Asia</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          Settlement powered by Stellar
          <svg width="14" height="14" viewBox="0 0 12 12">
            <path
              d="M6 0 L7.5 4.5 L12 6 L7.5 7.5 L6 12 L4.5 7.5 L0 6 L4.5 4.5 Z"
              fill="#00F5FF"
              stroke="#0A0A0A"
              strokeWidth="0.6"
            />
          </svg>
        </div>
      </div>
    </footer>
  );
}
