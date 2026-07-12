"use client";
import type { ButtonHTMLAttributes, CSSProperties } from "react";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

/**
 * App-surface button. `primary` = yellow accent, `secondary` = neutral outline,
 * `ghost` = text-only. Gentle hover lift; soft shadow (no hard offset).
 */
export default function Button({
  variant = "primary",
  fullWidth = false,
  disabled = false,
  style,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: ButtonProps) {
  const variants: Record<Variant, CSSProperties> = {
    primary: {
      background: disabled ? "var(--surface-2, #eee)" : "var(--accent, #FFE600)",
      color: disabled ? "var(--muted)" : "#0A0A0A",
      border: "1.5px solid var(--line-strong, #0A0A0A)",
    },
    secondary: {
      background: "var(--card)",
      color: "var(--card-text)",
      border: "1px solid var(--line, rgba(10,10,10,.14))",
    },
    ghost: {
      background: "transparent",
      color: "var(--text)",
      border: "1px solid transparent",
    },
  };

  const base: CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 13.5,
    fontWeight: 700,
    letterSpacing: 0.2,
    borderRadius: "var(--r-sm, 8px)",
    padding: "11px 18px",
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: variant === "ghost" ? "none" : "var(--shadow-sm, 0 1px 2px rgba(10,10,10,.06))",
    transition: "transform 0.12s, box-shadow 0.12s, background 0.12s",
    width: fullWidth ? "100%" : undefined,
    ...variants[variant],
    ...style,
  };

  return (
    <button
      type="button"
      disabled={disabled}
      style={base}
      onMouseEnter={(e) => {
        if (disabled) {
          onMouseEnter?.(e);
          return;
        }
        if (variant === "ghost") {
          e.currentTarget.style.background = "var(--surface-2, rgba(10,10,10,.045))";
        } else {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "var(--shadow, 0 6px 20px rgba(10,10,10,.08))";
        }
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "";
        if (variant === "ghost") {
          e.currentTarget.style.background = "transparent";
        } else {
          e.currentTarget.style.boxShadow = "var(--shadow-sm, 0 1px 2px rgba(10,10,10,.06))";
        }
        onMouseLeave?.(e);
      }}
      {...rest}
    />
  );
}
