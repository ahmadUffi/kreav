"use client";
import type { ReactNode } from "react";
import Button from "./Button";

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  /** Optional CTA button label. */
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * App-surface empty state — hairline panel, calm icon, optional CTA.
 */
export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 12,
        padding: "48px 24px",
        border: "1px solid var(--line, rgba(10,10,10,.14))",
        borderRadius: "var(--r, 10px)",
        background: "var(--card)",
        color: "var(--card-text)",
        boxShadow: "var(--shadow-sm, 0 1px 2px rgba(10,10,10,.06))",
      }}
    >
      <svg width="36" height="36" viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ opacity: 0.8 }}>
        <rect x="1" y="2" width="10" height="8" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
        <rect x="3" y="4" width="2" height="2" fill="var(--accent, #FFE600)" />
        <rect x="7" y="4" width="2" height="2" fill="var(--accent, #FFE600)" />
        <rect x="3" y="7" width="6" height="1" fill="currentColor" opacity="0.5" />
      </svg>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 17, fontWeight: 700 }}>{title}</div>
      {description && (
        <p
          style={{
            margin: 0,
            maxWidth: 380,
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--muted)",
          }}
        >
          {description}
        </p>
      )}
      {actionLabel && (
        <Button variant="primary" onClick={onAction} style={{ marginTop: 6 }}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
