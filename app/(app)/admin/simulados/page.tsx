import { ClipboardCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ComboChart, type ComboPoint } from '@/components/charts/combo-chart';
import { SegTabs } from '@/components/simulado/report';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { sql } from '@/lib/db';
import { ENEM_AREAS, type Simulado, type SimuladoStats } from '@/lib/types';
import { NewSimuladoButton } from './new-simulado';

export const metadata: Metadata = { title: 'Simulados · Admin' };

export default async function AdminSimulados({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const tab = (await searchParams).v === 'sem' ? 'sem' : 'tri';
  const [sims, subs] = await Promise.all([
    sql.query<Simulado>(`select * from simulados order by created_at desc`),
    sql.query<{ simulado_id: string; status: string; n: number }>(`select simulado_id, status, count(*)::int as n from simulado_submissions group by 1, 2`),
  ]);
  const count = (id: string, st: string) => subs.find((s) => s.simulado_id === id && s.status === st)?.n ?? 0;
  // Gráfico geral: média de cada simulado liberado (toque na barra abre o simulado)
  const released = sims.filter((s) => s.results_released && (s.stats as SimuladoStats)?.completed).reverse();
  const triSims = released.filter((s) => s.use_tri !== false);
  const plainSims = released.filter((s) => s.use_tri === false);
  const chart: ComboPoint[] = (tab === 'tri' ? triSims : plainSims).map((s) => {
    const st = s.stats as SimuladoStats;
    return tab === 'tri'
      ? { label: s.title, bar: st.meanTri, barLabel: st.meanTri.toFixed(0), href: `/admin/simulados/${s.id}` }
      : { label: s.title, bar: st.meanAccuracy, barLabel: `${Math.round(st.meanAccuracy)}%`, href: `/admin/simulados/${s.id}` };
  });
  return (
    <>
      <PageHeader title="Simulados" subtitle="Crie provas no padrão ENEM, acompanhe entregas e libere a nota TRI." actions={<NewSimuladoButton />} />
      {released.length > 0 && (
        <section className="mb-8 space-y-3">
          <SegTabs
            active={tab}
            tabs={[
              { key: 'tri', label: 'Notas TRI', href: '/admin/simulados', count: triSims.length },
              { key: 'sem', label: 'Sem TRI', href: '/admin/simulados?v=sem', count: plainSims.length },
            ]}
          />
          <Card className="p-4 sm:p-6">
            <p className="mb-2 text-sm font-bold text-ink">{tab === 'tri' ? 'Média TRI por simulado' : 'Média de acertos por simulado'}</p>
            {chart.length ? (
              tab === 'tri' ? (
                <ComboChart points={chart} barName="Média TRI" lineName="Evolução" />
              ) : (
                <ComboChart points={chart} min={0} max={100} ticks={[0, 25, 50, 75, 100]} barName="% de acertos" lineName="Evolução" />
              )
            ) : (
              <p className="py-8 text-center text-sm text-muted">Nenhum simulado deste tipo com resultado liberado.</p>
            )}
          </Card>
        </section>
      )}

      {sims.length ? (
        <div className="grid gap-3">
          {sims.map((s) => (
            <Link key={s.id} href={`/admin/simulados/${s.id}`} className="block min-w-0">
              <Card className="flex min-w-0 items-center gap-4 p-4 transition hover:border-brand/40">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-sm font-extrabold text-brand">{s.area}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{s.title}</p>
                  <p className="text-xs text-muted">
                    {ENEM_AREAS[s.area]} · {s.question_count} questões · {s.time_limit_minutes ? `${s.time_limit_minutes} min` : 'tempo livre'}
                  </p>
                </div>
                <div className="hidden flex-wrap justify-end gap-1.5 sm:flex">
                  <Badge tone={s.is_published ? 'success' : 'neutral'}>{s.is_published ? 'Publicado' : 'Rascunho'}</Badge>
                  {s.results_released && <Badge tone="brand">Resultados liberados</Badge>}
                  <Badge>{count(s.id, 'completed')} entregas</Badge>
                  {count(s.id, 'in_progress') > 0 && <Badge tone="warning">{count(s.id, 'in_progress')} fazendo</Badge>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState icon={<ClipboardCheck className="size-6" />} title="Nenhum simulado" description="Crie o primeiro simulado com PDF e gabarito." action={<NewSimuladoButton />} />
      )}
    </>
  );
}
