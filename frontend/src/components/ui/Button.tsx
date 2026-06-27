"use client";
import type { ButtonHTMLAttributes, CSSProperties } from "react";

type Variant = "primary" | "secondary" | "section";

const VARIANT_BG: Record<Variant, string> = {
  primary: "#FFE600",
  secondary: "#ffffff",
  section: "#FF3BFF",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

/**
 * Neobrutalism button — 3px ink border + 6px hard offset shadow.
 * Press effect (translate 2px + shadow shrink) applied via mouse handlers,
 * matching the inline pattern used in Hero.tsx / Waitlist.tsx.
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
  const base: CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: 1,
    textTransform: "uppercase",
    background: disabled ? "#cccccc" : VARIANT_BG[variant],
    color: "#0A0A0A",
    border: "3px solid #0A0A0A",
    padding: "15px 26px",
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: "6px 6px 0 #0A0A0A",
    transition: "transform 0.12s, box-shadow 0.12s",
    width: fullWidth ? "100%" : undefined,
    ...style,
  };

  return (
    <button
      type="button"
      disabled={disabled}
      style={base}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = "translate(2px, 2px)";
          e.currentTarget.style.boxShadow = "2px 2px 0 #0A0A0A";
        }
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = "6px 6px 0 #0A0A0A";
        onMouseLeave?.(e);
      }}
      {...rest}
    />
  );
}
