import type { CSSProperties, ReactNode } from "react";

export type IconName =
  | "overview"
  | "products"
  | "orders"
  | "wallet"
  | "site"
  | "settings"
  | "trend"
  | "plus"
  | "copy"
  | "external"
  | "check"
  | "chevronRight"
  | "menu"
  | "instagram"
  | "x"
  | "tiktok"
  | "youtube";

const PATHS: Record<IconName, ReactNode> = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  products: (
    <>
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="M3 8l9 5 9-5" />
      <path d="M12 13v8" />
    </>
  ),
  orders: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14" r="1" />
    </>
  ),
  site: (
    <>
      <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
    </>
  ),
  settings: (
    <>
      <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h6M14 18h6" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="8" cy="12" r="2" />
      <circle cx="12" cy="18" r="2" />
    </>
  ),
  trend: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M17 7h4v4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4 10 14" />
      <path d="M19 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
    </>
  ),
  check: <path d="M5 12l5 5L20 7" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17" cy="7" r="1" />
    </>
  ),
  x: <path d="M4 4l16 16M20 4 4 20" />,
  tiktok: (
    <>
      <path d="M10 9a4 4 0 1 0 4 4V4" />
      <path d="M14 4c0 2.5 2 4.5 5 4.5" />
    </>
  ),
  youtube: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="3" />
      <path d="M10.5 9.5v5l4-2.5-4-2.5Z" fill="currentColor" stroke="none" />
    </>
  ),
};

interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  style?: CSSProperties;
  className?: string;
  title?: string;
}

/**
 * Inline line-icon set (24×24, currentColor) for app UI chrome — used instead of
 * emoji for nav, stat cards, and actions. Decorative by default (aria-hidden).
 */
export default function Icon({ name, size = 18, strokeWidth = 1.8, style, className, title }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable={false}
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  );
}
