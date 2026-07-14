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
 * App-surface error state — hairline panel with a restrained danger accent,
 * message, and optional retry.
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
        gap: 12,
        padding: "48px 24px",
        border: "1px solid var(--line, rgba(10,10,10,.14))",
        borderRadius: "var(--r, 10px)",
        background: "var(--card)",
        color: "var(--card-text)",
        boxShadow: "var(--shadow-sm, 0 1px 2px rgba(10,10,10,.06))",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "var(--tone-danger-bg, rgba(255,77,0,.14))",
          color: "var(--tone-danger-fg, #b23a00)",
          fontFamily: "var(--font-mono)",
          fontWeight: 800,
          fontSize: 20,
        }}
      >
        !
      </div>
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
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} style={{ marginTop: 6 }}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
