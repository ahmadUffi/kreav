"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  {
    num: "01",
    color: "#FF4D00",
    title: "Set Up Your Store",
    body: "Connect your Stellar wallet, upload your ebook or preset, set your price. Your store is live at kreav.space/yourname in minutes.",
    icon: (
      <svg width="56" height="56" viewBox="0 0 16 16" shapeRendering="crispEdges">
        <rect x="2" y="3" width="12" height="3" fill="#FF4D00" stroke="#0A0A0A" />
        <rect x="2" y="6" width="12" height="8" fill="#FFE600" stroke="#0A0A0A" />
        <rect x="4" y="9" width="3" height="5" fill="#0A0A0A" />
        <rect x="9" y="9" width="3" height="3" fill="#00F5FF" stroke="#0A0A0A" />
      </svg>
    ),
  },
  {
    num: "02",
    color: "#FF3BFF",
    title: "Buyer Pays Their Way",
    body: "Buyers worldwide pay with methods they already use — QRIS, GCash, VietQR, and more. No signup required.",
    icon: (
      <svg width="56" height="56" viewBox="0 0 16 16" shapeRendering="crispEdges">
        <rect x="3" y="2" width="10" height="12" fill="#fff" stroke="#0A0A0A" />
        <rect x="5" y="4" width="6" height="3" fill="#0A0A0A" />
        <rect x="5" y="9" width="2" height="2" fill="#FFE600" stroke="#0A0A0A" />
        <rect x="9" y="9" width="2" height="2" fill="#FFE600" stroke="#0A0A0A" />
        <rect x="5" y="11" width="2" height="2" fill="#FF3BFF" stroke="#0A0A0A" />
        <rect x="9" y="11" width="2" height="2" fill="#00F5FF" stroke="#0A0A0A" />
      </svg>
    ),
  },
  {
    num: "03",
    color: "#00F5FF",
    title: "Delivered Instantly",
    body: "The moment payment clears, your buyer gets their file. No waiting. No manual sending. You get paid in your currency.",
    icon: (
      <svg width="56" height="56" viewBox="0 0 16 16" shapeRendering="crispEdges">
        <rect x="2" y="5" width="9" height="7" fill="#FFE600" stroke="#0A0A0A" />
        <rect x="2" y="5" width="9" height="2" fill="#0A0A0A" />
        <rect x="11" y="7" width="4" height="2" fill="#0A0A0A" />
        <rect x="13" y="6" width="2" height="4" fill="#0A0A0A" />
        <rect x="14" y="7" width="2" height="2" fill="#00F5FF" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const stepsRef = useRef<HTMLDivElement[]>([]);
  const numRefs = useRef<HTMLDivElement[]>([]);

  useGSAP(
    () => {
      const steps = stepsRef.current;
      if (!steps.length) return;

      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top 70%",
        once: true,
        onEnter: () => {
          gsap.fromTo(
            steps,
            { y: 60, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.55, stagger: 0.15 }
          );
          numRefs.current.forEach((el, i) => {
            const obj = { v: 0 };
            gsap.to(obj, {
              v: i + 1,
              duration: 0.9,
              delay: 0.2 + i * 0.15,
              onUpdate: () => {
                if (el) el.textContent = String(Math.round(obj.v)).padStart(2, "0");
              },
            });
          });
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      id="how"
      ref={sectionRef}
      className="mx-auto overflow-hidden px-6 py-16 md:px-10 md:py-[110px]"
      style={{
        position: "relative",
        maxWidth: 1280,
      }}
    >
      {/* Ghost number */}
      <div
        aria-hidden
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: "clamp(70px,15vw,200px)",
          lineHeight: 0.85,
          color: "var(--text)",
          opacity: 0.06,
          position: "absolute",
          top: 70,
          right: 30,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        01 02 03
      </div>

      <div
        style={{
          display: "inline-block",
          background: "#0A0A0A",
          color: "#FFE600",
          border: "3px solid #0A0A0A",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 3,
          textTransform: "uppercase",
          padding: "9px 14px",
          marginBottom: 50,
          fontFamily: "var(--font-mono)",
        }}
      >
        [ How It Works ]
      </div>

      <div
        className="grid grid-cols-1 md:grid-cols-3"
        style={{ gap: 26, position: "relative", zIndex: 2 }}
      >
        {STEPS.map((step, i) => (
          <div
            key={step.num}
            ref={(el) => { if (el) stepsRef.current[i] = el; }}
            style={{
              background: "var(--card)",
              border: "3px solid #0A0A0A",
              boxShadow: "6px 6px 0 #0A0A0A",
              padding: 26,
            }}
          >
            <div
              ref={(el) => { if (el) numRefs.current[i] = el; }}
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: 28,
                color: step.color,
                marginBottom: 22,
              }}
            >
              00
            </div>
            <div style={{ marginBottom: 18 }}>{step.icon}</div>
            <div
              style={{
                fontFamily: "var(--font-anton)",
                fontSize: 21,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                color: "var(--card-text)",
                marginBottom: 10,
              }}
            >
              {step.title}
            </div>
            <p
              style={{
                fontSize: 13,
                lineHeight: 1.65,
                color: "var(--muted)",
                margin: 0,
                fontFamily: "var(--font-mono)",
              }}
            >
              {step.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
