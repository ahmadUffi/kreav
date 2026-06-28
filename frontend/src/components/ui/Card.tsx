"use client";
import type { CSSProperties, HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Enable a subtle hover lift (raises the soft shadow). */
  hover?: boolean;
  padding?: number | string;
}

/**
 * App-surface card — hairline border, small radius, soft low shadow.
 * On hover (opt-in) it lifts slightly. Theme-aware via CSS vars.
 */
export default function Card({
  hover = false,
  padding = 24,
  style,
  onMouseEnter,
  onMouseLeave,
  children,
  ...rest
}: CardProps) {
  const base: CSSProperties = {
    background: "var(--card)",
    color: "var(--card-text)",
    border: "1px solid var(--line, rgba(10,10,10,.14))",
    borderRadius: "var(--r, 10px)",
    boxShadow: "var(--shadow-sm, 0 1px 2px rgba(10,10,10,.06))",
    padding,
    transition: "transform 0.15s, box-shadow 0.15s",
    ...style,
  };

  return (
    <div
      style={base}
      onMouseEnter={(e) => {
        if (hover) {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "var(--shadow, 0 6px 20px rgba(10,10,10,.08))";
        }
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (hover) {
          e.currentTarget.style.transform = "";
          e.currentTarget.style.boxShadow = "var(--shadow-sm, 0 1px 2px rgba(10,10,10,.06))";
        }
        onMouseLeave?.(e);
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
