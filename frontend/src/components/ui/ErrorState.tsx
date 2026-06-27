"use client";
import type { ReactNode } from "react";
import Button from "./Button";

interface ErrorStateProps {
  title?: string;
  description?: ReactNode;
  /** Optional retry button label. */
  retryLabel?: string;
  onRetry?: () => void;
}

/**
 * Neobrutalism error state — orange pixel warning icon, message, optional retry.
 */
export default function ErrorState({
  title = "Something went wrong",
  description,
  retryLabel = "Retry",
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 14,
        padding: "60px 24px",
        border: "3px solid #FF4D00",
        background: "var(--card)",
        color: "var(--card-text)",
        boxShadow: "6px 6px 0 #0A0A0A",
      }}
    >
      <svg width="40" height="40" viewBox="0 0 12 12" shapeRendering="crispEdges">
        <rect x="5" y="1" width="2" height="6" fill="#FF4D00" />
        <rect x="5" y="9" width="2" height="2" fill="#FF4D00" />
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
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} style={{ marginTop: 6 }}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
