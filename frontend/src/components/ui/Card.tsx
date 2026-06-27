"use client";
import type { CSSProperties, HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Enable the yellow-border + bigger-shadow hover lift (How It Works / Features pattern). */
  hover?: boolean;
  padding?: number | string;
}

/**
 * Neobrutalism card — theme-aware background, 3px ink border, 6px hard shadow.
 * On hover (opt-in) the border turns brand yellow and the shadow bumps to 8px.
 */
export default function Card({
  hover = false,
  padding = 26,
  style,
  onMouseEnter,
  onMouseLeave,
  children,
  ...rest
}: CardProps) {
  const base: CSSProperties = {
    background: "var(--card)",
    color: "var(--card-text)",
    border: "3px solid #0A0A0A",
    boxShadow: "6px 6px 0 #0A0A0A",
    padding,
    transition: "border-color 0.15s, box-shadow 0.15s",
    ...style,
  };

  return (
    <div
      style={base}
      onMouseEnter={(e) => {
        if (hover) {
          e.currentTarget.style.borderColor = "#FFE600";
          e.currentTarget.style.boxShadow = "8px 8px 0 #0A0A0A";
        }
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (hover) {
          e.currentTarget.style.borderColor = "#0A0A0A";
          e.currentTarget.style.boxShadow = "6px 6px 0 #0A0A0A";
        }
        onMouseLeave?.(e);
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
