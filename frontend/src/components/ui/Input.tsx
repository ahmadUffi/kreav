"use client";
import type { CSSProperties, InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Inline validation message — rendered in mono 12px. */
  error?: string;
}

/**
 * App-surface text input — hairline border, small radius, soft focus ring.
 * Optional label + inline error.
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
    padding: "12px 14px",
    borderRadius: "var(--r-sm, 8px)",
    border: `1.5px solid ${error ? "var(--tone-danger-fg, #FF4D00)" : "var(--line, rgba(10,10,10,.14))"}`,
    outline: "none",
    background: "var(--card)",
    color: "var(--card-text)",
    transition: "border-color 0.15s, box-shadow 0.15s",
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
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text)",
            marginBottom: 7,
          }}
        >
          {label}
        </label>
      )}
      <input
        id={id}
        style={inputStyle}
        onFocus={(e) => {
          if (!error) {
            e.currentTarget.style.borderColor = "var(--line-strong, #0A0A0A)";
            e.currentTarget.style.boxShadow = "var(--ring, 0 0 0 3px rgba(255,230,0,.4))";
          }
          onFocus?.(e);
        }}
        onBlur={(e) => {
          if (!error) {
            e.currentTarget.style.borderColor = "var(--line, rgba(10,10,10,.14))";
            e.currentTarget.style.boxShadow = "none";
          }
          onBlur?.(e);
        }}
        {...rest}
      />
      {error && (
        <p
          style={{
            margin: "7px 0 0",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--tone-danger-fg, #FF4D00)",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
