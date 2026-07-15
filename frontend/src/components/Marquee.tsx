"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";

const ITEMS = [
  "Sell Ebooks",
  "Sell Presets",
  "Sell Templates",
  "Get Paid In Your Currency",
  "Instant Delivery",
  "Worldwide",
  "Zero Monthly Fees",
];

function Diamond() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 10 10"
      style={{ margin: "0 22px", flexShrink: 0 }}
    >
      <path d="M5 0 L10 5 L5 10 L0 5 Z" fill="#FFE600" />
    </svg>
  );
}

export default function Marquee() {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const w = track.getBoundingClientRect().width / 2;
    const tween = gsap.to(track, {
      x: -w,
      duration: 38,
      ease: "none",
      repeat: -1,
    });
    return () => { tween.kill(); };
  }, []);

  const content = ITEMS.flatMap((item) => [item, <Diamond key={item} />]);

  return (
    <div
      style={{
        background: "#0A0A0A",
        borderTop: "3px solid #0A0A0A",
        borderBottom: "3px solid #0A0A0A",
        overflow: "hidden",
        padding: "15px 0",
      }}
    >
      <div ref={trackRef} style={{ display: "flex", width: "max-content", willChange: "transform" }}>
        {/* Two copies for seamless loop */}
        {[0, 1].map((copy) => (
          <div
            key={copy}
            style={{
              display: "flex",
              alignItems: "center",
              fontFamily: "var(--font-anton)",
              fontSize: 24,
              letterSpacing: 1,
              color: "#FFE600",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            {content}
          </div>
        ))}
      </div>
    </div>
  );
}
