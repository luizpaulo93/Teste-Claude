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
  /** Tocar na barra abre este link (relatório) */
  href?: string;
}

export function ComboChart({
  points,
  min = 300,
  max = 1000,
  barName = "TRI",
  lineName,
  ticks: tickValues,
}: {
  points: ComboPoint[];
  min?: number;
  max?: number;
  barName?: string;
  lineName?: string;
  ticks?: number[];
}) {
  if (!points.length) return null;
  // Poucas provas: tela menor para o texto não ficar miúdo no celular
  const W = Math.min(640, Math.max(340, points.length * 110));
  const H = 230;
  const pad = { l: 36, r: 12, t: 22, b: 30 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const slot = iw / points.length;
  const bw = Math.min(46, slot * 0.55);
  const cx = (i: number) => pad.l + slot * i + slot / 2;
  const y = (v: number) =>
    pad.t + ih - ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * ih;
  const ticks = (tickValues ?? [min, 500, 700, 900]).filter(
    (t) => t >= min && t <= max,
  );
  // Curva suave passando pelo topo de cada barra (acompanha o nível da nota)
  const tops = points
    .map((p, i) => (p.bar == null ? null : { x: cx(i), y: y(p.bar) }))
    .filter(Boolean) as { x: number; y: number }[];
  const curve = tops.reduce((d, pt, i, a) => {
    if (i === 0) return `M${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    const p0 = a[i - 2] ?? a[i - 1];
    const p1 = a[i - 1];
    const p2 = pt;
    const p3 = a[i + 1] ?? pt;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    return `${d} C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }, "");

  return (
    <div>
      <div className="scrollbar-thin -mx-1 overflow-x-auto px-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mx-auto h-auto w-full"
          style={{
            minWidth: points.length > 6 ? points.length * 58 : undefined,
            maxWidth: W < 640 ? W * 1.7 : undefined,
          }}
          role="img"
          aria-label="Desempenho por simulado"
        >
          <defs>
            <linearGradient id="cc-bar" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--brand)" stopOpacity="0.95" />
              <stop offset="1" stopColor="var(--brand)" stopOpacity="0.35" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={pad.l}
                x2={W - pad.r}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--line-strong)"
                strokeDasharray="3 4"
              />
              <text
                x={pad.l - 6}
                y={y(t) + 4}
                textAnchor="end"
                fontSize="10"
                fill="var(--muted)"
              >
                {t}
              </text>
            </g>
          ))}
          {points.map((p, i) => {
            if (p.bar == null) return null;
            const bar = (
              <g
                key={i}
                className={
                  p.href
                    ? "cursor-pointer [&:hover_rect.b]:opacity-80"
                    : undefined
                }
              >
                {p.href && (
                  <rect
                    x={cx(i) - slot / 2}
                    y={pad.t}
                    width={slot}
                    height={ih + pad.b}
                    fill="transparent"
                  />
                )}
                <rect
                  className="b"
                  x={cx(i) - bw / 2}
                  y={y(p.bar)}
                  width={bw}
                  height={pad.t + ih - y(p.bar)}
                  rx="6"
                  fill="url(#cc-bar)"
                />
                <text
                  x={cx(i)}
                  y={y(p.bar) - 10}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="var(--ink)"
                >
                  {p.barLabel ?? Math.round(p.bar)}
                </text>
              </g>
            );
            return p.href ? (
              <a
                key={i}
                href={p.href}
                aria-label={`${p.label}: ${p.barLabel ?? Math.round(p.bar)}`}
              >
                {bar}
              </a>
            ) : (
              bar
            );
          })}
          {tops.length > 1 && (
            <path
              d={curve}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeLinecap="round"
              pointerEvents="none"
            />
          )}
          {tops.map((t, i) => (
            <circle
              key={`l${i}`}
              cx={t.x}
              cy={t.y}
              r="4"
              fill="#f59e0b"
              stroke="var(--surface)"
              strokeWidth="2"
              pointerEvents="none"
            />
          ))}
          {points.map((p, i) => (
            <text
              key={`x${i}`}
              x={cx(i)}
              y={H - 10}
              textAnchor="middle"
              fontSize="10"
              fill="var(--muted)"
            >
              {p.label.length > 14 ? `${p.label.slice(0, 13)}…` : p.label}
            </text>
          ))}
        </svg>
      </div>
      <div className="mt-1 flex flex-wrap gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-brand" /> {barName}
        </span>
        {tops.length > 1 && (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-amber-500" />{" "}
            {lineName ?? "Evolução"}
          </span>
        )}
      </div>
    </div>
  );
}
