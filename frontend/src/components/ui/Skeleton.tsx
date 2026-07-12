"use client";
import type { CSSProperties } from "react";

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  /** Show a hairline border (for card-shaped placeholders). */
  bordered?: boolean;
  style?: CSSProperties;
}

/**
 * Loading placeholder — pulses via the `kv-skeleton` keyframe in globals.css.
 * Rounded, theme-aware fill.
 */
export default function Skeleton({
  width = "100%",
  height = 20,
  bordered = false,
  style,
}: SkeletonProps) {
  return (
    <div
      className="kv-skeleton"
      aria-hidden
      style={{
        width,
        height,
        background: "var(--muted)",
        opacity: 0.22,
        borderRadius: "var(--r-sm, 8px)",
        border: bordered ? "1px solid var(--line, rgba(10,10,10,.14))" : "none",
        ...style,
      }}
    />
  );
}
