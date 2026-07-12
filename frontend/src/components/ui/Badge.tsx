"use client";
import type { CSSProperties, ReactNode } from "react";

type Tone = "accent" | "neutral" | "success" | "warn" | "danger";

interface BadgeProps {
  children: ReactNode;
  /** Colour tone — accent (yellow) by default. */
  tone?: Tone;
  /** Ink background with yellow text, for rare emphasis. */
  inverted?: boolean;
  /** Wrap the label in square brackets ([ Label ]). Off by default. */
  brackets?: boolean;
  style?: CSSProperties;
}

const TONES: Record<Tone, { bg: string; fg: string }> = {
  accent: { bg: "var(--accent, #FFE600)", fg: "#0A0A0A" },
  neutral: { bg: "var(--tone-neutral-bg, rgba(10,10,10,.06))", fg: "var(--tone-neutral-fg, #3a3a3a)" },
  success: { bg: "var(--tone-success-bg, rgba(2,158,87,.14))", fg: "var(--tone-success-fg, #0a7a45)" },
  warn: { bg: "var(--tone-warn-bg, rgba(255,184,0,.18))", fg: "var(--tone-warn-fg, #8a5a00)" },
  danger: { bg: "var(--tone-danger-bg, rgba(255,77,0,.14))", fg: "var(--tone-danger-fg, #b23a00)" },
};

/**
 * App-surface chip / eyebrow — small, soft tinted background, no hard border.
 */
export default function Badge({
  children,
  tone = "accent",
  inverted = false,
  brackets = false,
  style,
}: BadgeProps) {
  const t = TONES[tone];
  const base: CSSProperties = {
    display: "inline-block",
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    padding: "4px 9px",
    borderRadius: "var(--r-sm, 8px)",
    background: inverted ? "#0A0A0A" : t.bg,
    color: inverted ? "var(--accent, #FFE600)" : t.fg,
    ...style,
  };

  return <span style={base}>{brackets ? <>[ {children} ]</> : children}</span>;
}
