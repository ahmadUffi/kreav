"use client";
import type { CSSProperties, ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  /** Inverted = ink background with yellow text (no shadow), per design.md. */
  inverted?: boolean;
  /** Wrap the label in square brackets ([ Label ]) per the eyebrow anatomy. */
  brackets?: boolean;
  style?: CSSProperties;
}

/**
 * Neobrutalism eyebrow / badge — JetBrains Mono 700, 12px, uppercase,
 * 3px ink border, 4px hard shadow. Default yellow; inverted = ink/yellow.
 */
export default function Badge({
  children,
  inverted = false,
  brackets = true,
  style,
}: BadgeProps) {
  const base: CSSProperties = {
    display: "inline-block",
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 3,
    textTransform: "uppercase",
    padding: "9px 14px",
    background: inverted ? "#0A0A0A" : "#FFE600",
    color: inverted ? "#FFE600" : "#0A0A0A",
    border: inverted ? "none" : "3px solid #0A0A0A",
    boxShadow: inverted ? "none" : "4px 4px 0 #0A0A0A",
    ...style,
  };

  return (
    <span style={base}>
      {brackets ? <>[ {children} ]</> : children}
    </span>
  );
}
