"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const FEATURES = [
  {
    letter: "A",
    letterColor: "#FF4D00",
    bg: "#ffffff",
    title: "Sell In Any Currency",
    body: "Your buyer pays in PHP. You receive IDR. The conversion happens automatically. No FX fees. No hidden spread.",
    from: "left",
    icon: (
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 32 }}>
        <div style={{ width: 7, height: 13, background: "#FFE600", border: "2px solid #0A0A0A" }} />
        <div style={{ width: 7, height: 22, background: "#FF3BFF", border: "2px solid #0A0A0A" }} />
        <div style={{ width: 7, height: 32, background: "#00F5FF", border: "2px solid #0A0A0A" }} />
      </div>
    ),
  },
  {
    letter: "B",
    letterColor: "#0A0A0A",
    bg: "#FFE600",
    checker: true,
    title: "Split Revenue With Collabs",
    body: "Selling a collab ebook? Split the revenue automatically. Your co-creator gets their cut the same moment you get yours.",
    from: "right",
    icon: (
      <div style={{ width: 32, height: 32, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", border: "2px solid #0A0A0A" }}>
        <div style={{ background: "#FF3BFF" }} />
        <div style={{ background: "#00F5FF" }} />
        <div style={{ background: "#0A0A0A" }} />
        <div style={{ background: "#fff" }} />
      </div>
    ),
  },
  {
    letter: "C",
    letterColor: "#0A0A0A",
    bg: "#FFE600",
    checker: true,
    title: "Instant Settlement",
    body: "Not next day. Not 3 business days. The moment your buyer pays — you have your money.",
    from: "left",
    icon: (
      <div style={{ width: 40, height: 24, border: "2px solid #0A0A0A", borderBottom: "none", borderRadius: "40px 40px 0 0", overflow: "hidden", background: "#fff", position: "relative" }}>
        <div style={{ position: "absolute", left: 18, bottom: 0, width: 3, height: 18, background: "#FF4D00", transformOrigin: "bottom", transform: "rotate(40deg)" }} />
      </div>
    ),
  },
  {
    letter: "D",
    letterColor: "#FF3BFF",
    bg: "#ffffff",
    title: "Your Store, Your Rules",
    body: "No platform lock-in. Your files, your prices, your link. We only earn when you earn — 5% per sale, nothing else.",
    from: "right",
    icon: (
      <svg width="32" height="36" viewBox="0 0 14 16" shapeRendering="crispEdges">
        <rect x="2" y="2" width="10" height="3" fill="#0A0A0A" />
        <rect x="2" y="5" width="10" height="6" fill="#00F5FF" stroke="#0A0A0A" strokeWidth="1" />
        <rect x="4" y="11" width="6" height="3" fill="#0A0A0A" />
        <rect x="6" y="7" width="2" height="2" fill="#0A0A0A" />
      </svg>
    ),
  },
];

export default function Features() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const cards = sectionRef.current?.querySelectorAll("[data-feature]");
      cards?.forEach((el) => {
        const from = el.getAttribute("data-from") === "right" ? 70 : -70;
        gsap.fromTo(
          el,
          { x: from, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 0.6,
            scrollTrigger: { trigger: el, start: "top 82%" },
          }
        );
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 40px 100px" }}
    >
      <div
        style={{
          display: "inline-block",
          background: "#FF3BFF",
          color: "#0A0A0A",
          border: "3px solid #0A0A0A",
          boxShadow: "4px 4px 0 #0A0A0A",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 3,
          textTransform: "uppercase",
          padding: "9px 14px",
          marginBottom: 46,
          fontFamily: "var(--font-mono)",
        }}
      >
        [ Built Different ]
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26 }}>
        {FEATURES.map((f) => (
          <div
            key={f.letter}
            data-feature
            data-from={f.from}
            style={{
              position: "relative",
              background: f.bg,
              backgroundImage: f.checker
                ? "repeating-conic-gradient(#FFE600 0 25%,#f3d600 0 50%)"
                : undefined,
              backgroundSize: f.checker ? "26px 26px" : undefined,
              border: "3px solid #0A0A0A",
              boxShadow: "6px 6px 0 #0A0A0A",
              padding: 30,
              overflow: "hidden",
              transition: "border-color 0.2s, box-shadow 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#FFE600";
              (e.currentTarget as HTMLElement).style.boxShadow = "8px 8px 0 #0A0A0A";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#0A0A0A";
              (e.currentTarget as HTMLElement).style.boxShadow = "6px 6px 0 #0A0A0A";
            }}
          >
            <div style={{ position: "absolute", top: 22, right: 22 }}>{f.icon}</div>
            <div
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: 11,
                color: f.letterColor,
                marginBottom: 18,
              }}
            >
              {f.letter}
            </div>
            <div
              style={{
                fontFamily: "var(--font-anton)",
                fontSize: 25,
                textTransform: "uppercase",
                color: "#0A0A0A",
                marginBottom: 12,
                maxWidth: "78%",
              }}
            >
              {f.title}
            </div>
            <p
              style={{
                fontSize: 13.5,
                lineHeight: 1.65,
                color: f.checker ? "#1a1a1a" : "#3a3a3a",
                margin: 0,
                fontFamily: "var(--font-mono)",
              }}
            >
              {f.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
