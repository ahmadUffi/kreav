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
 * Neobrutalism empty state — pixel-art box icon, title, description, optional CTA.
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
        gap: 14,
        padding: "60px 24px",
        border: "3px dashed #0A0A0A",
        background: "var(--card)",
        color: "var(--card-text)",
      }}
    >
      <svg width="40" height="40" viewBox="0 0 12 12" shapeRendering="crispEdges">
        <rect x="1" y="2" width="10" height="8" fill="none" stroke="#0A0A0A" strokeWidth="1" />
        <rect x="3" y="4" width="2" height="2" fill="#FFE600" />
        <rect x="7" y="4" width="2" height="2" fill="#FFE600" />
        <rect x="3" y="7" width="6" height="1" fill="#0A0A0A" />
      </svg>
      <div
        style={{
          fontFamily: "var(--font-anton)",
          fontSize: 21,
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
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
