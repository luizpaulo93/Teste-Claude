/** Gráfico de linha leve em SVG puro (sem biblioteca) — evolução de notas. */
export function LineChart({ points, min = 300, max = 1000 }: { points: { label: string; value: number }[]; min?: number; max?: number }) {
  if (!points.length) return null;
  const W = 600;
  const H = 200;
  const pad = { l: 36, r: 12, t: 16, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i: number) => pad.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - ((v - min) / (max - min)) * ih;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${d} L${x(points.length - 1)},${pad.t + ih} L${x(0)},${pad.t + ih} Z`;
  const ticks = [min, (min + max) / 2, max].map(Math.round);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Evolução das notas">
      <defs>
        <linearGradient id="lc-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--brand)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line-strong)" strokeDasharray="3 4" />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">
            {t}
          </text>
        </g>
      ))}
      <path d={area} fill="url(#lc-fill)" />
      <path d={d} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.value)} r="4.5" fill="var(--surface)" stroke="var(--brand)" strokeWidth="2.5" />
          <text x={x(i)} y={y(p.value) - 10} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--ink)">
            {Math.round(p.value)}
          </text>
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">
            {p.label.length > 12 ? `${p.label.slice(0, 11)}…` : p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
