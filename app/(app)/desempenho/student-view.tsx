import { Award, BarChart3, ChevronRight, ClipboardCheck, FileCheck2, Target, Trophy } from 'lucide-react';
import Link from 'next/link';
import { ComboChart } from '@/components/charts/combo-chart';
import { Card, EmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';

export interface PerfItem {
  key: string;
  title: string;
  kind: string;
  tri: boolean;
  at: string;
  /** % de acertos */
  pct: number;
  ok: number;
  total: number;
  triScore?: number;
  coherence?: number;
  href: string;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const MAX = 20;

/**
 * Desempenho do aluno: seletor Com TRI / Sem TRI.
 * Sem seletor: os últimos 20 (com e sem TRI), do mais recente ao mais antigo.
 * Com seletor: o relatório de notas da categoria e os cards só dela.
 */
export function StudentPerformance({ items, cat, turma }: { items: PerfItem[]; cat: 'tri' | 'sem' | null; turma: string }) {
  const all = [...items].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const inCat = cat ? all.filter((x) => (cat === 'tri' ? x.tri : !x.tri)) : all;
  const shown = inCat.slice(0, MAX);
  const chip = (k: 'tri' | 'sem', label: string) => (
    <Link
      href={cat === k ? '/desempenho' : `/desempenho?c=${k}`}
      aria-pressed={cat === k}
      className={cn(
        'shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition',
        cat === k ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-2 hover:border-brand/50',
      )}
    >
      {label}
    </Link>
  );
  const best = inCat.length ? Math.max(...inCat.map((x) => x.pct)) : 0;
  // gráfico: do mais antigo ao mais recente (até 20); toque na barra abre o teste ou simulado
  const recent = [...shown].reverse();
  const chart =
    cat === 'tri'
      ? recent.map((x) => ({ label: x.title, bar: x.triScore ?? null, href: x.href }))
      : recent.map((x) => ({ label: x.title, bar: x.pct, barLabel: `${x.pct}%`, href: x.href }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Desempenho</h1>
        <p className="mt-0.5 text-sm text-muted">{turma ? `Sua turma: ${turma}` : 'Seus simulados e testes'}</p>
      </div>

      <div className="flex gap-2" role="group" aria-label="Tipo de nota">
        {chip('tri', 'Com TRI')}
        {chip('sem', 'Sem TRI')}
      </div>

      {cat && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {cat === 'tri' && (
              <Kpi icon={<Trophy className="size-4" />} label="Sua média TRI" value={inCat.length ? Math.round(avg(inCat.map((x) => x.triScore ?? 0))) : '—'} />
            )}
            <Kpi icon={<Target className="size-4" />} label="Média de acertos" value={inCat.length ? `${Math.round(avg(inCat.map((x) => x.pct)))}%` : '—'} />
            <Kpi icon={<Award className="size-4" />} label="Melhor resultado" value={inCat.length ? `${best}%` : '—'} />
            <Kpi
              icon={<ClipboardCheck className="size-4" />}
              label={cat === 'tri' ? 'Simulados feitos' : 'Testes e simulados'}
              value={inCat.length}
            />
            {cat === 'tri' ? (
              <Kpi icon={<FileCheck2 className="size-4" />} label="Sua coerência" value={inCat.length ? `${Math.round(avg(inCat.map((x) => x.coherence ?? 0)))}%` : '—'} />
            ) : (
              <Kpi
                icon={<FileCheck2 className="size-4" />}
                label="Acertos / questões"
                value={`${inCat.reduce((a, x) => a + x.ok, 0)}/${inCat.reduce((a, x) => a + x.total, 0)}`}
              />
            )}
          </div>
          {cat === 'tri' && chart.length > 1 && (
            <Card className="p-4 sm:p-5">
              <p className="mb-3 text-sm font-bold text-ink">Evolução da sua nota TRI</p>
              <ComboChart points={chart} barName="Sua nota TRI" lineName="Evolução" />
            </Card>
          )}
          {cat === 'sem' && chart.length > 0 && (
            <Card className="p-4 sm:p-5">
              <p className="mb-3 text-sm font-bold text-ink">Seu % de acerto em cada teste e simulado</p>
              <ComboChart points={chart} min={0} max={100} ticks={[0, 25, 50, 75, 100]} barName="% de acerto" lineName="Evolução" />
            </Card>
          )}
        </>
      )}

      <section className="space-y-2">
        <p className="text-xs text-muted">{inCat.length > MAX ? `Os ${MAX} mais recentes, do mais novo ao mais antigo` : 'Do mais recente ao mais antigo'}</p>
        {shown.length ? (
          <ul className="space-y-2">
            {shown.map((it) => (
              <li key={it.key}>
                <Link href={it.href} aria-label={`${it.title}: ${it.tri ? `nota ${Math.round(it.triScore ?? 0)}` : `${it.pct}% de acerto`}`}>
                  <Card className="flex items-center gap-3 p-3.5 transition hover:border-brand/40">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{it.title}</span>
                        <span className="shrink-0 text-sm font-extrabold text-ink tabular-nums">
                          {it.tri ? Math.round(it.triScore ?? 0) : `${it.pct}%`}
                        </span>
                      </span>
                      <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-surface-3">
                        <span
                          className={cn('block h-full rounded-full', it.pct >= 70 ? 'bg-success' : it.pct >= 40 ? 'bg-warning' : 'bg-danger')}
                          style={{ width: `${Math.max(3, it.pct)}%` }}
                        />
                      </span>
                      <span className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-muted">
                        <span className={cn('font-semibold', it.tri ? 'text-brand' : 'text-success')}>{it.kind}</span>
                        <span>
                          {it.ok}/{it.total} acertos{it.tri ? ` · ${it.pct}%` : ''}
                        </span>
                        <span>{new Date(it.at).toLocaleDateString('pt-BR', { timeZone: 'America/Belem' })}</span>
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted" />
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<BarChart3 className="size-5" />}
            title={cat === 'tri' ? 'Nenhum simulado com TRI ainda' : cat === 'sem' ? 'Nenhum teste sem TRI ainda' : 'Ainda sem resultados'}
          />
        )}
      </section>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <span className="text-brand">{icon}</span> {label}
      </p>
      <p className="mt-1.5 text-2xl font-extrabold text-ink tabular-nums">{value}</p>
    </Card>
  );
}
