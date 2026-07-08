"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/context/theme";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

export default function Nav() {
  const router = useRouter();
  const { dark, toggle } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const navRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const logoRRef = useRef<HTMLSpanElement>(null);
  const logoCRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const past = window.scrollY > window.innerHeight * 0.6;
      setScrolled(past);
      const max =
        document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? (window.scrollY / max) * 100 : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const doGlitch = () => {
    const r = logoRRef.current;
    const c = logoCRef.current;
    if (!r || !c) return;
    gsap.set([r, c], { opacity: 1 });
    const tl = gsap.timeline({
      onComplete: () => gsap.set([r, c], { opacity: 0, x: 0 }),
    });
    for (let i = 0; i < 6; i++) {
      tl.set(r, { x: Math.random() * 6 - 3 })
        .set(c, { x: Math.random() * 6 - 3 })
        .to({}, { duration: 0.05 });
    }
  };

  const navBg = scrolled ? "#0A0A0A" : "transparent";
  const navBorder = scrolled ? "2px solid #FFE600" : "2px solid transparent";
  const linkColor = scrolled ? "#ffffff" : "var(--text)";

  return (
    <>
      {/* Progress bar */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: 3,
          width: `${progress}%`,
          background: "#FFE600",
          zIndex: 200,
          transition: "width 0.05s linear",
        }}
      />

      <nav
        ref={navRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 150,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 40px",
          background: navBg,
          borderBottom: navBorder,
          transition: "background 0.15s, border-color 0.15s",
        }}
      >
        {/* Logo */}
        <div
          ref={logoRef}
          style={{ display: "flex", alignItems: "center", gap: 11, cursor: "pointer" }}
          onMouseEnter={doGlitch}
        >
          <svg width="20" height="20" viewBox="0 0 12 12">
            <rect x="5" y="0" width="2" height="3" fill="#0A0A0A" />
            <rect x="5" y="9" width="2" height="3" fill="#0A0A0A" />
            <rect x="0" y="5" width="3" height="2" fill="#0A0A0A" />
            <rect x="9" y="5" width="3" height="2" fill="#0A0A0A" />
            <rect x="4" y="4" width="4" height="4" fill="#FFE600" stroke="#0A0A0A" strokeWidth="1" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
            <div style={{ position: "relative", fontFamily: "var(--font-anton)", fontSize: 24, letterSpacing: 1 }}>
              <span style={{ position: "relative", zIndex: 2, color: linkColor }}>KREAV</span>
              <span
                ref={logoRRef}
                aria-hidden
                style={{
                  position: "absolute", left: 0, top: 0, zIndex: 1,
                  color: "#FF3BFF", clipPath: "inset(0 0 50% 0)", opacity: 0,
                }}
              >
                KREAV
              </span>
              <span
                ref={logoCRef}
                aria-hidden
                style={{
                  position: "absolute", left: 0, top: 0, zIndex: 1,
                  color: "#00F5FF", clipPath: "inset(50% 0 0 0)", opacity: 0,
                }}
              >
                KREAV
              </span>
            </div>
            <span style={{ fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: "#888", marginTop: 2 }}>
              Sell digital products across Asia.
            </span>
          </div>
        </div>

        {/* Nav links + buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24, fontSize: 12, textTransform: "uppercase", letterSpacing: "1.5px" }}>
            {["How It Works|#how", "For Creators|#creators", "Pricing|#pricing"].map((item) => {
              const [label, href] = item.split("|");
              return (
                <a
                  key={href}
                  href={href}
                  style={{ position: "relative", textDecoration: "none", color: linkColor, paddingBottom: 3 }}
                  className="group"
                >
                  {label}
                  <span
                    style={{
                      position: "absolute", left: 0, bottom: 0,
                      height: 2, width: "100%", background: "#FFE600",
                      transform: "scaleX(0)", transformOrigin: "left",
                      display: "block", transition: "transform 0.25s",
                    }}
                    className="group-hover:scale-x-100"
                  />
                </a>
              );
            })}
          </div>

          <button
            onClick={toggle}
            style={{
              fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
              letterSpacing: 1, background: "transparent",
              color: linkColor, border: `2px solid ${linkColor}`,
              padding: "7px 9px", cursor: "pointer", textTransform: "uppercase",
            }}
          >
            {dark ? "LIGHT" : "DARK"}
          </button>

          <button
            onClick={() => router.push("/store")}
            style={{
              fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 800,
              letterSpacing: 1, textTransform: "uppercase",
              background: "#FFE600", color: "#0A0A0A",
              border: "4px solid #0A0A0A", padding: "11px 18px",
              cursor: "pointer", boxShadow: "4px 4px 0 #0A0A0A",
            }}
          >
            Start Selling
          </button>
        </div>
      </nav>
    </>
  );
}
