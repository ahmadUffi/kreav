"use client";
import type { CSSProperties } from "react";

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  /** Show the 3px ink border + hard shadow (use for card-shaped placeholders). */
  bordered?: boolean;
  style?: CSSProperties;
}

/**
 * Neobrutalism loading placeholder — pulses via the `kv-skeleton` keyframe
 * defined in globals.css. Theme-aware fill so it works in light + dark.
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
        opacity: 0.5,
        border: bordered ? "3px solid #0A0A0A" : "none",
        boxShadow: bordered ? "6px 6px 0 #0A0A0A" : "none",
        ...style,
      }}
    />
  );
}
