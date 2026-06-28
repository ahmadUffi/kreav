import Card from "./Card";
import Icon, { type IconName } from "./Icon";
import Sparkline from "@/components/charts/Sparkline";

interface StatCardProps {
  label: string;
  value: string;
  /** % change vs previous period (sign drives colour + arrow). */
  delta?: number;
  icon?: IconName;
  spark?: number[];
}

/** KPI card — label + icon, big value, delta, optional sparkline. */
export default function StatCard({ label, value, delta, icon, spark }: StatCardProps) {
  const negative = delta !== undefined && delta < 0;
  return (
    <Card style={{ padding: 18 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>{label}</span>
        {icon && (
          <span style={{ color: "var(--muted)" }}>
            <Icon name={icon} size={16} />
          </span>
        )}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{value}</div>
      <div className="flex items-center justify-between" style={{ marginTop: 12, minHeight: 28 }}>
        {delta !== undefined ? (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              fontWeight: 700,
              color: negative ? "var(--tone-danger-fg, #b23a00)" : "var(--tone-success-fg, #0a7a45)",
            }}
          >
            {negative ? "▼" : "▲"} {Math.abs(delta)}%
          </span>
        ) : (
          <span />
        )}
        {spark && (
          <Sparkline data={spark} width={88} height={26} color={negative ? "var(--tone-danger-fg, #b23a00)" : "var(--accent, #FFE600)"} />
        )}
      </div>
    </Card>
  );
}
