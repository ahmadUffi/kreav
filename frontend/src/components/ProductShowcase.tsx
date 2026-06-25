"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const ShowcaseCanvas = dynamic(() => import("./ShowcaseCanvas"), { ssr: false });

const SUBLINES = [
  "One upload. Infinite buyers.",
  "Your price. Their currency. No friction.",
  "Delivered the second they pay.",
];

export default function ProductShowcase() {
  const sectionRef = useRef<HTMLElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const [subIdx, setSubIdx] = useState(0);

  useEffect(() => {
    const el = subRef.current;
    if (!el) return;
    let idx = 0;
    let t: ReturnType<typeof setTimeout>;
    const cycle = () => {
      t = setTimeout(() => {
        el.style.transition = "opacity 0.35s, transform 0.35s";
        el.style.opacity = "0";
        el.style.transform = "translateY(-6px)";
        setTimeout(() => {
          idx = (idx + 1) % SUBLINES.length;
          setSubIdx(idx);
          el.style.transition = "none";
          el.style.opacity = "0";
          el.style.transform = "translateY(6px)";
          requestAnimationFrame(() => {
            el.style.transition = "opacity 0.35s, transform 0.35s";
            el.style.opacity = "1";
            el.style.transform = "translateY(0)";
          });
          cycle();
        }, 350);
      }, 3000);
    };
    cycle();
    return () => clearTimeout(t);
  }, []);

  return (
    <section
      id="creators"
      ref={sectionRef}
      style={{ background: "var(--bg)", maxWidth: 1180, margin: "0 auto", padding: "30px 40px 90px" }}
    >
      <div
        style={{
          display: "inline-block",
          background: "#FFE600",
          color: "#0A0A0A",
          border: "3px solid #0A0A0A",
          boxShadow: "4px 4px 0 #0A0A0A",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 3,
          textTransform: "uppercase",
          padding: "9px 14px",
          marginBottom: 50,
          fontFamily: "var(--font-mono)",
        }}
      >
        [ What Creators Sell ]
      </div>

      <div style={{ maxWidth: 880, margin: "0 0 6px" }}>
        <h3
          style={{
            fontFamily: "var(--font-anton)",
            fontSize: "clamp(30px,4.6vw,58px)",
            textTransform: "uppercase",
            color: "var(--text)",
            margin: 0,
            lineHeight: 0.96,
          }}
        >
          Sell anything digital.
          <br />
          If it&apos;s a file, it belongs on Kreav.
        </h3>
      </div>

      <div
        ref={subRef}
        style={{
          fontSize: 15,
          letterSpacing: 0.5,
          color: "var(--muted)",
          minHeight: 22,
          marginBottom: 6,
          fontFamily: "var(--font-mono)",
        }}
      >
        {SUBLINES[subIdx]}
      </div>

      <ShowcaseCanvas />
    </section>
  );
}
