interface AreaChartProps {
  data: number[];
  height?: number;
  color?: string;
}

/**
 * Revenue-style area + line chart (pure SVG, no deps). Responsive via a fixed
 * viewBox stretched to 100% width; strokes stay crisp via non-scaling-stroke.
 */
export default function AreaChart({ data, height = 220, color = "var(--accent, #FFE600)" }: AreaChartProps) {
  if (data.length < 2) return null;
  const W = 600;
  const H = height;
  const pad = { t: 14, r: 6, b: 14, l: 6 };
  const max = Math.max(...data);
  const min = Math.min(0, ...data);
  const range = max - min || 1;
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const x = (i: number) => pad.l + (i / (data.length - 1)) * innerW;
  const y = (v: number) => pad.t + innerH - ((v - min) / range) * innerH;

  const line = data.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L ${x(data.length - 1).toFixed(1)} ${(pad.t + innerH).toFixed(1)} L ${x(0).toFixed(1)} ${(pad.t + innerH).toFixed(1)} Z`;
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => pad.t + innerH - f * innerH);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      width="100%"
      height={H}
      role="img"
      aria-label="Revenue over the last 30 days"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id="kv-area-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {grid.map((gy, i) => (
        <line
          key={i}
          x1={pad.l}
          x2={W - pad.r}
          y1={gy}
          y2={gy}
          stroke="var(--line, rgba(10,10,10,.14))"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <path d={area} fill="url(#kv-area-fill)" />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
