/**
 * Barras (nota TRI) + linha (coerência ou média da turma), em SVG puro — estilo MemberClass.
 * Valores das barras e da linha na escala da TRI (300–1000); a linha pode ter um rótulo próprio.
 */
export interface ComboPoint {
  label: string;
  bar: number | null;
  line?: number | null;
  barLabel?: string;
  lineLabel?: string;
}

export function ComboChart({ points, min = 300, max = 1000, barName = 'TRI', lineName }: { points: ComboPoint[]; min?: number; max?: number; barName?: string; lineName?: string }) {
  if (!points.length) return null;
  const W = 640;
  const H = 230;
  const pad = { l: 36, r: 12, t: 22, b: 30 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const slot = iw / points.length;
  const bw = Math.min(46, slot * 0.55);
  const cx = (i: number) => pad.l + slot * i + slot / 2;
  const y = (v: number) => pad.t + ih - ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * ih;
  const ticks = [min, 500, 700, 900].filter((t) => t >= min && t <= max);
  const linePts = points.map((p, i) => (p.line == null ? null : `${cx(i).toFixed(1)},${y(p.line).toFixed(1)}`)).filter(Boolean) as string[];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Desempenho por simulado">
        <defs>
          <linearGradient id="cc-bar" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--brand)" stopOpacity="0.95" />
            <stop offset="1" stopColor="var(--brand)" stopOpacity="0.35" />
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
        {points.map((p, i) =>
          p.bar == null ? null : (
            <g key={i}>
              <rect x={cx(i) - bw / 2} y={y(p.bar)} width={bw} height={pad.t + ih - y(p.bar)} rx="6" fill="url(#cc-bar)" />
              <text x={cx(i)} y={y(p.bar) - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ink)">
                {p.barLabel ?? Math.round(p.bar)}
              </text>
            </g>
          ),
        )}
        {linePts.length > 1 && <polyline points={linePts.join(' ')} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinejoin="round" />}
        {points.map((p, i) =>
          p.line == null ? null : <circle key={`l${i}`} cx={cx(i)} cy={y(p.line)} r="4" fill="#f59e0b" stroke="var(--surface)" strokeWidth="2" />,
        )}
        {points.map((p, i) => (
          <text key={`x${i}`} x={cx(i)} y={H - 10} textAnchor="middle" fontSize="10" fill="var(--muted)">
            {p.label.length > 14 ? `${p.label.slice(0, 13)}…` : p.label}
          </text>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-brand" /> {barName}
        </span>
        {lineName && (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-amber-500" /> {lineName}
          </span>
        )}
      </div>
    </div>
  );
}
