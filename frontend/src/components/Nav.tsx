"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/context/theme";
import gsap from "gsap";

export default function Nav() {
  const router = useRouter();
  const { dark, toggle } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
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

  const LINKS = [
    { label: "How It Works", href: "#how" },
    { label: "For Creators", href: "#creators" },
    { label: "Pricing", href: "#pricing" },
  ];

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
        className="px-5 py-3.5 md:px-10 md:py-4"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 150,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
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
            <span className="hidden sm:block" style={{ fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: "#888", marginTop: 2 }}>
              Sell digital products worldwide.
            </span>
          </div>
        </div>

        {/* Desktop nav links + buttons */}
        <div className="hidden md:flex" style={{ alignItems: "center", gap: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24, fontSize: 12, textTransform: "uppercase", letterSpacing: "1.5px" }}>
            {LINKS.map(({ label, href }) => (
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
            ))}
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

        {/* Mobile hamburger */}
        <button
          className="flex md:hidden"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          style={{
            alignItems: "center", justifyContent: "center",
            background: "transparent", color: linkColor,
            border: `2px solid ${linkColor}`, padding: 8, cursor: "pointer",
          }}
        >
          {menuOpen ? (
            <svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
              <line x1="3" y1="3" x2="17" y2="17" />
              <line x1="17" y1="3" x2="3" y2="17" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" shapeRendering="crispEdges">
              <rect x="2" y="4" width="16" height="2.5" fill="currentColor" />
              <rect x="2" y="9" width="16" height="2.5" fill="currentColor" />
              <rect x="2" y="14" width="16" height="2.5" fill="currentColor" />
            </svg>
          )}
        </button>

        {/* Mobile menu panel */}
        {menuOpen && (
          <div
            className="md:hidden"
            style={{
              position: "absolute", top: "100%", left: 0, right: 0,
              background: "#0A0A0A", borderTop: "2px solid #FFE600",
              borderBottom: "2px solid #FFE600", padding: "18px 20px 24px",
              display: "flex", flexDirection: "column",
            }}
          >
            {LINKS.map(({ label, href }) => (
              <a
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                style={{
                  color: "#ffffff", textDecoration: "none",
                  fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700,
                  letterSpacing: 1.5, textTransform: "uppercase",
                  padding: "13px 0", borderBottom: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                {label}
              </a>
            ))}

            <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
              <button
                onClick={toggle}
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700,
                  letterSpacing: 1, background: "transparent", color: "#ffffff",
                  border: "2px solid #ffffff", padding: "11px 14px",
                  cursor: "pointer", textTransform: "uppercase",
                }}
              >
                {dark ? "LIGHT" : "DARK"}
              </button>
              <button
                onClick={() => { setMenuOpen(false); router.push("/store"); }}
                style={{
                  flex: 1, fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 800,
                  letterSpacing: 1, textTransform: "uppercase",
                  background: "#FFE600", color: "#0A0A0A",
                  border: "3px solid #FFE600", padding: "11px 18px",
                  cursor: "pointer", boxShadow: "4px 4px 0 rgba(255,230,0,0.35)",
                }}
              >
                Start Selling
              </button>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
