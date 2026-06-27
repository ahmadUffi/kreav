import Link from "next/link";

const LINKS = [
  { label: "Store", href: "/store" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Wallet", href: "/wallet/connect" },
];

/**
 * Slim footer for the app surface — quiet, hairline top border. The marketing
 * landing keeps its own full-brutalism Footer (components/Footer.tsx).
 */
export default function AppFooter() {
  return (
    <footer
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "20px 40px",
        borderTop: "1px solid var(--line, rgba(10,10,10,.14))",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        color: "var(--muted)",
      }}
    >
      <span>© 2026 Kreav — non-custodial creator marketplace</span>
      <div style={{ display: "flex", gap: 18 }}>
        {LINKS.map(({ label, href }) => (
          <Link key={href} href={href} style={{ color: "var(--muted)", textDecoration: "none" }}>
            {label}
          </Link>
        ))}
      </div>
    </footer>
  );
}
