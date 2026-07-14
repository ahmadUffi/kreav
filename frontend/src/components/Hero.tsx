"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

const MapCanvas = dynamic(() => import("./MapCanvas"), { ssr: false });

const TYPEWRITER_LINES = [
  "Sell your ebook to fans in the Philippines.",
  "Sell your preset to buyers in Vietnam.",
  "Sell your template to creators in Thailand.",
];

const BADGES = [
  { label: "Instant Delivery", color: "#FF4D00" },
  { label: "Any Currency", color: "#00F5FF" },
  { label: "5+ Countries", color: "#FF3BFF" },
];

export default function Hero() {
  const router = useRouter();
  const sectionRef = useRef<HTMLElement>(null);
  const typedRef = useRef<HTMLSpanElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  function startTypewriter() {
    const span = typedRef.current;
    if (!span) return;
    let li = 0;
    const type = () => {
      const txt = TYPEWRITER_LINES[li];
      let i = 0;
      const tick = () => {
        span.textContent = txt.slice(0, i);
        i++;
        if (i <= txt.length) {
          timersRef.current.push(setTimeout(tick, 42));
        } else {
          timersRef.current.push(setTimeout(erase, 2000));
        }
      };
      const erase = () => {
        let j = txt.length;
        const e = () => {
          span.textContent = txt.slice(0, j);
          j--;
          if (j >= 0) {
            timersRef.current.push(setTimeout(e, 22));
          } else {
            li = (li + 1) % TYPEWRITER_LINES.length;
            timersRef.current.push(setTimeout(type, 250));
          }
        };
        e();
      };
      tick();
    };
    type();
  }

  // Entrance animations
  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reduced) {
        sectionRef.current?.querySelectorAll("[data-hero]").forEach((e) => {
          (e as HTMLElement).style.opacity = "1";
          (e as HTMLElement).style.transform = "none";
        });
        startTypewriter();
        return;
      }

      const k = 1;
      const tl = gsap.timeline({ defaults: { ease: "power3.out" }, onComplete: startTypewriter });

      tl.fromTo("[data-r=nav]", { y: -60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, 0)
        .fromTo("[data-r=eyebrow]", { clipPath: "inset(0 100% 0 0)", opacity: 0 }, { clipPath: "inset(0 0% 0 0)", opacity: 1, duration: 0.5 }, 0.2)
        .fromTo("[data-r=h1-1]", { x: -80 * k, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: "back.out(1.2)" }, 0.4)
        .fromTo("[data-r=h1-2]", { x: 80 * k, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: "back.out(1.2)" }, 0.6)
        .fromTo("[data-r=h1-3]", { x: -80 * k, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: "back.out(1.2)" }, 0.8)
        .fromTo("[data-r=sub]", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, 1.0)
        .fromTo("[data-r=cta-1],[data-r=cta-2]", { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: "elastic.out(1,0.5)", stagger: 0.08 }, 1.2)
        .fromTo("[data-r=badge]", { x: -16, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, stagger: 0.02 }, 1.4)
        .fromTo("[data-r=map-wrap]", { scale: 0.95, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.9 }, 1.6)
        .fromTo("[data-r=float-card]", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.15 }, 2.0);

      // Float cards loop
      document.querySelectorAll("[data-r=float-card]").forEach((c, i) => {
        gsap.to(c, { y: "+=12", duration: 2.4 + i * 0.4, ease: "sine.inOut", repeat: -1, yoyo: true, delay: 2.6 + i * 0.2 });
      });
    },
    { scope: sectionRef }
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => { timers.forEach(clearTimeout); };
  }, []);

  return (
    <section
      ref={sectionRef}
      style={{
        position: "relative",
        minHeight: "100vh",
        padding: "130px 40px 60px",
        display: "grid",
        gridTemplateColumns: "55% 45%",
        gap: 24,
        alignItems: "center",
        maxWidth: 1440,
        margin: "0 auto",
      }}
    >
      {/* Left: copy */}
      <div style={{ position: "relative", zIndex: 5 }}>
        <div
          data-r="eyebrow"
          data-hero
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
            padding: "8px 14px",
            marginBottom: 28,
            opacity: 0,
            fontFamily: "var(--font-mono)",
          }}
        >
          [ Digital Marketplace for Asia ]
        </div>

        <h1
          style={{
            fontFamily: "var(--font-anton)",
            fontWeight: 400,
            lineHeight: 0.9,
            letterSpacing: -0.5,
            margin: "0 0 26px",
            fontSize: "clamp(46px,7.4vw,112px)",
          }}
        >
          <span
            data-r="h1-1"
            data-hero
            style={{ display: "block", color: "var(--text)", opacity: 0 }}
          >
            Sell Your
          </span>
          <span
            data-r="h1-2"
            data-hero
            style={{ display: "block", color: "var(--text)", opacity: 0 }}
          >
            Digital Work
          </span>
          <span
            data-r="h1-3"
            data-hero
            style={{
              display: "inline-block",
              color: "#FFE600",
              WebkitTextStroke: "2px #0A0A0A",
              transform: "rotate(-1deg)",
              background: "#0A0A0A",
              padding: "0 14px",
              marginTop: 4,
              whiteSpace: "nowrap",
              opacity: 0,
            }}
          >
            Everywhere.
          </span>
        </h1>

        <div
          data-r="sub"
          data-hero
          style={{
            fontSize: 16,
            lineHeight: 1.55,
            color: "var(--muted)",
            maxWidth: 440,
            minHeight: 50,
            margin: "0 0 30px",
            opacity: 0,
            fontFamily: "var(--font-mono)",
          }}
        >
          <span ref={typedRef} />
          <span
            style={{
              display: "inline-block",
              width: 11,
              height: 3,
              background: "var(--text)",
              marginLeft: 3,
              verticalAlign: "baseline",
            }}
            className="kv-blink"
          />
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 30 }}>
          <button
            data-r="cta-1"
            data-hero
            onClick={() => router.push("/store")}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: 1,
              textTransform: "uppercase",
              background: "#FFE600",
              color: "#0A0A0A",
              border: "3px solid #0A0A0A",
              padding: "15px 26px",
              cursor: "pointer",
              boxShadow: "6px 6px 0 #0A0A0A",
              opacity: 0,
              transition: "transform 0.12s, box-shadow 0.12s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "translate(2px,2px)";
              (e.currentTarget as HTMLElement).style.boxShadow = "2px 2px 0 #0A0A0A";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "";
              (e.currentTarget as HTMLElement).style.boxShadow = "6px 6px 0 #0A0A0A";
            }}
          >
            Start Selling
          </button>
          <button
            data-r="cta-2"
            data-hero
            onClick={() => router.push("/store")}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: 1,
              textTransform: "uppercase",
              background: "#ffffff",
              color: "#0A0A0A",
              border: "3px solid #0A0A0A",
              padding: "15px 26px",
              cursor: "pointer",
              boxShadow: "6px 6px 0 #0A0A0A",
              opacity: 0,
              transition: "transform 0.12s, box-shadow 0.12s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "translate(2px,2px)";
              (e.currentTarget as HTMLElement).style.boxShadow = "2px 2px 0 #0A0A0A";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "";
              (e.currentTarget as HTMLElement).style.boxShadow = "6px 6px 0 #0A0A0A";
            }}
          >
            See Products
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {BADGES.map((b) => (
            <div
              key={b.label}
              data-r="badge"
              data-hero
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                background: "var(--card)",
                border: "2px solid #0A0A0A",
                borderRadius: 3,
                padding: "7px 11px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                color: "var(--card-text)",
                opacity: 0,
                fontFamily: "var(--font-mono)",
              }}
            >
              <svg width="9" height="9" viewBox="0 0 10 10">
                <path d="M5 0 L10 5 L5 10 L0 5 Z" fill={b.color} />
              </svg>
              {b.label}
            </div>
          ))}
        </div>
      </div>

      {/* Right: map + floating cards */}
      <div
        data-r="map-wrap"
        data-hero
        style={{ position: "relative", width: "100%", height: 560, opacity: 0 }}
      >
        <MapCanvas />

        {/* Floating product card 1 */}
        <div
          data-r="float-card"
          data-hero
          style={{
            position: "absolute",
            top: "4%",
            left: "-6%",
            background: "#fff",
            border: "3px solid #0A0A0A",
            boxShadow: "5px 5px 0 #0A0A0A",
            padding: 10,
            transform: "rotate(-3deg)",
            opacity: 0,
            width: 172,
          }}
        >
          <div
            style={{
              width: "100%",
              height: 62,
              background: "#FF3BFF",
              border: "2px solid #0A0A0A",
              display: "grid",
              placeItems: "center",
              marginBottom: 8,
              backgroundImage: "repeating-linear-gradient(45deg,#FF3BFF 0 6px,#e92fe9 6px 12px)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: 9,
                color: "#0A0A0A",
                background: "#FFE600",
                padding: "3px 5px",
                border: "2px solid #0A0A0A",
              }}
            >
              EBOOK
            </span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#0A0A0A", fontFamily: "var(--font-mono)" }}>
            Lightroom Preset Pack
          </div>
          <div style={{ fontFamily: "var(--font-anton)", fontSize: 16, color: "#0A0A0A" }}>
            Rp85.000
          </div>
        </div>

        {/* Floating product card 2 */}
        <div
          data-r="float-card"
          data-hero
          style={{
            position: "absolute",
            bottom: "8%",
            left: "-8%",
            background: "#fff",
            border: "3px solid #0A0A0A",
            boxShadow: "5px 5px 0 #0A0A0A",
            padding: 10,
            transform: "rotate(2deg)",
            opacity: 0,
            width: 160,
          }}
        >
          <div
            style={{
              width: "100%",
              height: 56,
              border: "2px solid #0A0A0A",
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gridTemplateRows: "repeat(2,1fr)",
              marginBottom: 8,
            }}
          >
            <div style={{ background: "#00F5FF", border: "1px solid #0A0A0A" }} />
            <div style={{ background: "#FFE600", border: "1px solid #0A0A0A" }} />
            <div style={{ background: "#0A0A0A" }} />
            <div style={{ background: "#0A0A0A" }} />
            <div style={{ background: "#00F5FF", border: "1px solid #0A0A0A" }} />
            <div style={{ background: "#FFE600", border: "1px solid #0A0A0A" }} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#0A0A0A", fontFamily: "var(--font-mono)" }}>
            Notion Template
          </div>
          <div style={{ fontFamily: "var(--font-anton)", fontSize: 16, color: "#0A0A0A" }}>
            PHP 299
          </div>
        </div>

        {/* Floating sale card */}
        <div
          data-r="float-card"
          data-hero
          style={{
            position: "absolute",
            top: "34%",
            right: "-8%",
            background: "#FFE600",
            border: "3px solid #0A0A0A",
            boxShadow: "5px 5px 0 #0A0A0A",
            padding: "11px 13px",
            transform: "rotate(3deg)",
            opacity: 0,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <svg width="26" height="26" viewBox="0 0 12 12" shapeRendering="crispEdges">
            <rect x="1" y="6" width="2" height="2" fill="#0A0A0A" />
            <rect x="3" y="8" width="2" height="2" fill="#0A0A0A" />
            <rect x="5" y="6" width="2" height="2" fill="#0A0A0A" />
            <rect x="7" y="4" width="2" height="2" fill="#0A0A0A" />
            <rect x="9" y="2" width="2" height="2" fill="#0A0A0A" />
          </svg>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#0A0A0A", fontFamily: "var(--font-mono)" }}>
              Sold to Manila!
            </div>
            <div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "#0A0A0A", fontFamily: "var(--font-mono)" }}>
              Delivered instantly
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
