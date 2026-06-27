"use client";
import type { CSSProperties, InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Inline validation message — rendered in mono 12px per role.md form rules. */
  error?: string;
}

/**
 * Neobrutalism text input — 3px ink border, mono font, no native outline.
 * Border turns brand yellow on focus. Optional label + inline error.
 */
export default function Input({
  label,
  error,
  style,
  id,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const inputStyle: CSSProperties = {
    width: "100%",
    fontFamily: "var(--font-mono)",
    fontSize: 14,
    padding: "14px 16px",
    border: `3px solid ${error ? "#FF4D00" : "#0A0A0A"}`,
    outline: "none",
    background: "var(--card)",
    color: "var(--card-text)",
    ...style,
  };

  return (
    <div style={{ width: "100%" }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            display: "block",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "var(--text)",
            marginBottom: 8,
          }}
        >
          {label}
        </label>
      )}
      <input
        id={id}
        style={inputStyle}
        onFocus={(e) => {
          if (!error) e.currentTarget.style.borderColor = "#FFE600";
          onFocus?.(e);
        }}
        onBlur={(e) => {
          if (!error) e.currentTarget.style.borderColor = "#0A0A0A";
          onBlur?.(e);
        }}
        {...rest}
      />
      {error && (
        <p
          style={{
            margin: "8px 0 0",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            fontWeight: 700,
            color: "#FF4D00",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
