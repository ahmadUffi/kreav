export interface BarItem {
  label: string;
  value: number;
  /** Optional secondary text shown on the right (e.g. "64 sales"). */
  sub?: string;
}

interface BarChartProps {
  items: BarItem[];
  color?: string;
  /** Format the value for the right-aligned label. */
  format?: (v: number) => string;
}

/** Horizontal bar chart built with HTML (crisp, responsive, labelled). */
export default function BarChart({ items, color = "var(--accent, #FFE600)", format }: BarChartProps) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {items.map((it) => (
        <div key={it.label}>
          <div className="flex items-center justify-between" style={{ marginBottom: 6, fontFamily: "var(--font-mono)", fontSize: 12 }}>
            <span style={{ fontWeight: 600 }}>{it.label}</span>
            <span style={{ color: "var(--muted)" }}>{it.sub ?? (format ? format(it.value) : it.value)}</span>
          </div>
          <div style={{ height: 10, borderRadius: 999, background: "var(--surface-2, rgba(10,10,10,.06))", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(it.value / max) * 100}%`, background: color, borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
