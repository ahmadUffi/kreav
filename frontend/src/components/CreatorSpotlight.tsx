"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const CREATORS = [
  { name: "Maya R.", flag: "ID", sells: "Lightroom Presets", sales: "143", accent: "#FF3BFF", bg: "#fff" },
  { name: "Jacob L.", flag: "PH", sells: "Notion Templates", sales: "287", accent: "#00F5FF", bg: "#FFE600" },
  { name: "Linh T.", flag: "VN", sells: "Figma Kits", sales: "96", accent: "#FFE600", bg: "#fff" },
  { name: "Arif H.", flag: "ID", sells: "Photography Guides", sales: "214", accent: "#FF4D00", bg: "#FFE600" },
  { name: "Sari K.", flag: "ID", sells: "Procreate Brushes", sales: "178", accent: "#00F5FF", bg: "#fff" },
];

export default function CreatorSpotlight() {
  const wrapRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!wrapRef.current) return;
    gsap.fromTo(
      wrapRef.current.querySelectorAll("[data-spotcard]"),
      { y: 30, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.5,
        stagger: 0.1,
        scrollTrigger: { trigger: wrapRef.current, start: "top 84%" },
      }
    );
  });

  return (
    <section id="creators" style={{ padding: "20px 0 100px", overflow: "hidden" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 40px" }}>
        <div
          style={{
            display: "inline-block",
            background: "#00F5FF",
            color: "#0A0A0A",
            border: "3px solid #0A0A0A",
            boxShadow: "4px 4px 0 #0A0A0A",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 3,
            textTransform: "uppercase",
            padding: "9px 14px",
            marginBottom: 36,
            fontFamily: "var(--font-mono)",
          }}
        >
          [ Creators On Kreav ]
        </div>
      </div>

      <div
        ref={wrapRef}
        className="kv-spot"
        style={{
          display: "flex",
          gap: 24,
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          padding: "8px 40px 28px",
          maxWidth: 1360,
          margin: "0 auto",
        }}
      >
        {CREATORS.map((c) => (
          <div
            key={c.name}
            data-spotcard
            style={{
              flexShrink: 0,
              width: 260,
              scrollSnapAlign: "start",
              background: c.bg,
              border: "3px solid #0A0A0A",
              boxShadow: "5px 5px 0 #0A0A0A",
              padding: 22,
              transition: "box-shadow 0.2s, transform 0.2s",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              gsap.to(e.currentTarget, { y: -4, boxShadow: "8px 10px 0 #0A0A0A", duration: 0.2 });
            }}
            onMouseLeave={(e) => {
              gsap.to(e.currentTarget, { y: 0, boxShadow: "5px 5px 0 #0A0A0A", duration: 0.2 });
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: 64,
                height: 64,
                background: c.accent,
                border: "3px solid #0A0A0A",
                marginBottom: 16,
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 22,
                  background: "#0A0A0A",
                  borderRadius: "50% 50% 0 0",
                  marginBottom: -2,
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontFamily: "var(--font-anton)", fontSize: 22, color: "#0A0A0A" }}>
                {c.name}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 1,
                  border: "2px solid #0A0A0A",
                  padding: "2px 5px",
                  color: "#0A0A0A",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {c.flag}
              </span>
            </div>

            <div
              style={{
                fontSize: 12,
                color: "#3a3a3a",
                marginBottom: 14,
                fontFamily: "var(--font-mono)",
              }}
            >
              Selling: {c.sells}
            </div>

            <span
              style={{
                display: "inline-block",
                background: "#FFE600",
                border: "2px solid #0A0A0A",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                padding: "5px 9px",
                color: "#0A0A0A",
                fontFamily: "var(--font-mono)",
              }}
            >
              {c.sales} sales
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
