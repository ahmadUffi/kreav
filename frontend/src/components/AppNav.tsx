"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/context/theme";

const LINKS = [
  { label: "Store", href: "/store" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Wallet", href: "/wallet/connect" },
];

/**
 * App shell navigation — slim bar with a hairline underline, calm active state,
 * and a theme toggle. Refined (not brutalist) to match the app surface.
 */
export default function AppNav() {
  const { dark, toggle } = useTheme();
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 150,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 40px",
        background: "color-mix(in srgb, var(--bg) 88%, transparent)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid var(--line, rgba(10,10,10,.14))",
      }}
    >
      {/* Logo → back to marketing landing */}
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
        <svg width="18" height="18" viewBox="0 0 12 12">
          <rect x="5" y="0" width="2" height="3" fill="currentColor" />
          <rect x="5" y="9" width="2" height="3" fill="currentColor" />
          <rect x="0" y="5" width="3" height="2" fill="currentColor" />
          <rect x="9" y="5" width="3" height="2" fill="currentColor" />
          <rect x="4" y="4" width="4" height="4" fill="#FFE600" stroke="currentColor" strokeWidth="1" />
        </svg>
        <span style={{ fontFamily: "var(--font-anton)", fontSize: 22, letterSpacing: 0.5, color: "var(--text)" }}>
          KREAV
        </span>
      </Link>

      {/* Links + theme toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {LINKS.map(({ label, href }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              style={{
                textDecoration: "none",
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                color: active ? "var(--text)" : "var(--muted)",
                background: active ? "var(--surface-2, rgba(10,10,10,.06))" : "transparent",
                padding: "7px 12px",
                borderRadius: "var(--r-sm, 8px)",
                transition: "color 0.15s, background 0.15s",
              }}
            >
              {label}
            </Link>
          );
        })}

        <button
          onClick={toggle}
          aria-label="Toggle colour theme"
          style={{
            marginLeft: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            lineHeight: 1,
            background: "transparent",
            color: "var(--text)",
            border: "1px solid var(--line, rgba(10,10,10,.14))",
            borderRadius: "var(--r-sm, 8px)",
            padding: "7px 9px",
            cursor: "pointer",
          }}
        >
          {dark ? "☀" : "☾"}
        </button>
      </div>
    </nav>
  );
}
