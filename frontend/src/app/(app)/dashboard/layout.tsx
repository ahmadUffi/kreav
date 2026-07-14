"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/ui/Icon";
import TrustlineBanner from "@/components/TrustlineBanner";

const ITEMS: { label: string; href: string; icon: IconName }[] = [
  { label: "Overview", href: "/dashboard", icon: "overview" },
  { label: "Products", href: "/dashboard/products", icon: "products" },
  { label: "Orders", href: "/dashboard/orders", icon: "orders" },
  { label: "Wallet", href: "/dashboard/wallet", icon: "wallet" },
  { label: "Mini-site", href: "/dashboard/site", icon: "site" },
  { label: "Settings", href: "/dashboard/settings", icon: "settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href));

  return (
    <div className="mx-auto max-w-[1280px] px-6 pt-8 pb-[90px] md:px-10">
      <div className="flex flex-col gap-6 md:flex-row md:gap-8">
        {/* Sidebar (desktop) */}
        <aside className="hidden md:block" style={{ width: 210, flexShrink: 0 }}>
          <nav className="sticky flex flex-col gap-1" style={{ top: 84 }}>
            {ITEMS.map((it) => (
              <NavLink key={it.href} {...it} active={isActive(it.href)} />
            ))}
          </nav>
        </aside>

        {/* Nav (mobile) */}
        <nav className="flex gap-1 overflow-x-auto md:hidden" style={{ paddingBottom: 4 }}>
          {ITEMS.map((it) => (
            <NavLink key={it.href} {...it} active={isActive(it.href)} />
          ))}
        </nav>

        <div className="min-w-0 flex-1">
          <TrustlineBanner />
          {children}
        </div>
      </div>
    </div>
  );
}

function NavLink({ label, href, icon, active }: { label: string; href: string; icon: IconName; active: boolean }) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        whiteSpace: "nowrap",
        textDecoration: "none",
        fontFamily: "var(--font-mono)",
        fontSize: 13.5,
        fontWeight: active ? 700 : 500,
        color: active ? "var(--text)" : "var(--muted)",
        background: active ? "var(--surface-2, rgba(10,10,10,.06))" : "transparent",
        border: "1px solid transparent",
        borderColor: active ? "var(--line, rgba(10,10,10,.14))" : "transparent",
        padding: "9px 12px",
        borderRadius: "var(--r-sm, 8px)",
        transition: "color 0.15s, background 0.15s",
      }}
    >
      <Icon name={icon} size={17} />
      {label}
    </Link>
  );
}
