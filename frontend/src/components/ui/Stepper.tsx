interface StepperProps {
  steps: string[];
  /** 0-based index of the active step. */
  current: number;
}

/**
 * Onboarding progress indicator — current step label + "Step X of N" + a
 * segmented bar. App-surface (refined) styling.
 */
export default function Stepper({ steps, current }: StepperProps) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
          {steps[current]}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>
          Step {current + 1} of {steps.length}
        </span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {steps.map((s, i) => (
          <div
            key={s}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 999,
              background: i <= current ? "var(--accent, #FFE600)" : "var(--surface-2, rgba(10,10,10,.08))",
              transition: "background 0.25s",
            }}
          />
        ))}
      </div>
    </div>
  );
}
