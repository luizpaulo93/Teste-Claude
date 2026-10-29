import { ChevronRight, Trophy, Users } from 'lucide-react';
import Link from 'next/link';
import { ComboChart, type ComboPoint } from '@/components/charts/combo-chart';
import { SegTabs } from '@/components/simulado/report';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';

const medal = (i: number) => (i === 0 ? 'bg-amber-400 text-black' : i === 1 ? 'bg-slate-300 text-black' : i === 2 ? 'bg-orange-400 text-black' : 'bg-surface-3 text-ink-2');
export const fmt = (kind: 'tri' | 'sem', v: number) => (kind === 'tri' ? v.toFixed(0) : `${Math.round(v)}%`);

export function KindTabs({ kind, base }: { kind: 'tri' | 'sem'; base: string }) {
  const sep = base.includes('?') ? '&' : '?';
  return (
    <SegTabs
      active={kind}
      tabs={[
        { key: 'tri', label: 'Notas TRI', href: base },
        { key: 'sem', label: 'Sem TRI', href: `${base}${sep}v=sem` },
      ]}
    />
  );
}

/** Gráfico das médias por simulado (toque na barra abre o relatório). */
export function MeansChart({ kind, title, points }: { kind: 'tri' | 'sem'; title: string; points: ComboPoint[] }) {
  return (
    <Card className="p-4 sm:p-6">
      <p className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
        <Trophy className="size-4 text-warning" /> {title}
      </p>
      {points.length ? (
        kind === 'tri' ? (
          <ComboChart points={points} min={200} ticks={[200, 400, 600, 800, 1000]} barName="Média TRI" lineName="Evolução" />
        ) : (
          <ComboChart points={points} min={0} max={100} ticks={[0, 25, 50, 75, 100]} barName="% de acertos" lineName="Evolução" />
        )
      ) : (
        <p className="py-8 text-center text-sm text-muted">Nenhum simulado deste tipo com resultado liberado.</p>
      )}
    </Card>
  );
}

export function RankList({
  title,
  icon,
  items,
}: {
  title: string;
  icon: 'users' | 'trophy';
  items: { key: string; href: string; name: string; sub: string; value: string; unit: string }[];
}) {
  if (!items.length) return null;
  return (
    <section className="space-y-2.5">
      <h2 className="flex items-center gap-2 text-base font-bold text-ink">
        {icon === 'users' ? <Users className="size-4 text-brand" /> : <Trophy className="size-4 text-warning" />} {title}
      </h2>
      <ol className="overflow-hidden rounded-2xl border border-line bg-surface">
        {items.map((it, i) => (
          <li key={it.key} className="border-b border-line last:border-b-0">
            <Link href={it.href} className="flex items-center gap-3 px-3.5 py-3 transition hover:bg-surface-2 sm:px-4">
              <span className={cn('grid size-8 shrink-0 place-items-center rounded-full text-xs font-extrabold', medal(i))}>{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{it.name}</span>
                <span className="block truncate text-[11px] text-muted">{it.sub}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-base font-extrabold text-ink tabular-nums">{it.value}</span>
                <span className="block text-[10px] text-muted uppercase">{it.unit}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
