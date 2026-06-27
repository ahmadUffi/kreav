"use client";
import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/context/theme";
import gsap from "gsap";

const LINKS = [
  { label: "Store", href: "/store" },
  { label: "Signup", href: "/signup" },
  { label: "Dashboard", href: "/dashboard" },
];

/**
 * App shell navigation — fixed bar reusing the marketing Nav's neobrutalism
 * patterns (glitch logo, mono links, theme toggle). Active route is derived
 * from usePathname() and highlighted in brand yellow.
 */
export default function AppNav() {
  const { dark, toggle } = useTheme();
  const pathname = usePathname();
  const logoRRef = useRef<HTMLSpanElement>(null);
  const logoCRef = useRef<HTMLSpanElement>(null);

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

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 150,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 40px",
        background: "var(--bg)",
        borderBottom: "3px solid #0A0A0A",
      }}
    >
      {/* Logo → back to marketing landing */}
      <Link
        href="/"
        onMouseEnter={doGlitch}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 11,
          textDecoration: "none",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 12 12">
          <rect x="5" y="0" width="2" height="3" fill="#0A0A0A" />
          <rect x="5" y="9" width="2" height="3" fill="#0A0A0A" />
          <rect x="0" y="5" width="3" height="2" fill="#0A0A0A" />
          <rect x="9" y="5" width="3" height="2" fill="#0A0A0A" />
          <rect x="4" y="4" width="4" height="4" fill="#FFE600" stroke="#0A0A0A" strokeWidth="1" />
        </svg>
        <div
          style={{
            position: "relative",
            fontFamily: "var(--font-anton)",
            fontSize: 24,
            letterSpacing: 1,
          }}
        >
          <span style={{ position: "relative", zIndex: 2, color: "var(--text)" }}>KREAV</span>
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
      </Link>

      {/* Links + theme toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "1.5px",
          }}
        >
          {LINKS.map(({ label, href }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                style={{
                  position: "relative",
                  textDecoration: "none",
                  color: active ? "#0A0A0A" : "var(--text)",
                  background: active ? "#FFE600" : "transparent",
                  padding: active ? "4px 8px" : "4px 0",
                  border: active ? "2px solid #0A0A0A" : "2px solid transparent",
                  fontWeight: active ? 700 : 400,
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <button
          onClick={toggle}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1,
            background: "transparent",
            color: "var(--text)",
            border: "2px solid var(--text)",
            padding: "7px 9px",
            cursor: "pointer",
            textTransform: "uppercase",
          }}
        >
          {dark ? "LIGHT" : "DARK"}
        </button>
      </div>
    </nav>
  );
}
