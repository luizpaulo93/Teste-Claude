import { CheckCircle2, ChevronRight, ClipboardCheck, Clock, Hourglass, Lock, Trophy } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ComboChart, type ComboPoint } from '@/components/charts/combo-chart';
import { SegTabs } from '@/components/simulado/report';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { loadOverview } from '@/lib/simulado-report';
import { requireViewer } from '@/lib/session';
import { fmt, KindTabs, MeansChart, RankList } from './overview';
import { sql } from '@/lib/db';
import { ENEM_AREAS, type Simulado, type SimuladoResult, type SimuladoSubmission } from '@/lib/types';

export const metadata: Metadata = { title: 'Simulados' };

export default async function SimuladosPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const tab = (await searchParams).v === 'sem' ? 'sem' : 'tri';
  const viewer = await requireViewer();
  if (!viewer.isMember) redirect('/');
  const [simulados, subs, results] = await Promise.all([
    sql.query<Simulado>(
      `select id, title, area, question_count, time_limit_minutes, results_released, use_tri, created_at from simulados where is_published order by created_at desc`,
    ),
    sql.query<Pick<SimuladoSubmission, 'simulado_id' | 'status'>>(`select simulado_id, status from simulado_submissions where user_id = $1`, [viewer.userId]),
    sql.query<SimuladoResult>(`select simulado_id, tri_score, correct, accuracy from simulado_results where user_id = $1`, [viewer.userId]),
  ]);
  const subBy = new Map(subs.map((s) => [s.simulado_id, s.status]));
  const resBy = new Map(results.map((r) => [r.simulado_id, r]));

  // Notas do aluno, separadas em provas com TRI e sem TRI (mais antiga → mais recente)
  const done = simulados.filter((s) => resBy.has(s.id)).reverse();
  const triDone = done.filter((s) => s.use_tri !== false);
  const plainDone = done.filter((s) => s.use_tri === false);
  const shown = tab === 'tri' ? triDone : plainDone;
  // Provas com nota são acessadas pelo gráfico; embaixo ficam só as que o aluno ainda pode fazer
  const toDo = viewer.isAdmin ? [] : simulados.filter((s) => !resBy.has(s.id) && !s.results_released);
  const chart: ComboPoint[] = shown.map((s) => {
    const r = resBy.get(s.id)!;
    return tab === 'tri'
      ? { label: s.title, bar: Number(r.tri_score), barLabel: Number(r.tri_score).toFixed(0), href: `/simulados/${s.id}` }
      : { label: s.title, bar: Number(r.accuracy), barLabel: `${Math.round(Number(r.accuracy))}%`, href: `/simulados/${s.id}` };
  });

  return (
    <>
      <PageHeader eyebrow="ENEM" title="Simulados" subtitle="Faça as provas no tempo oficial e acompanhe sua nota estimada pela TRI." />

      {viewer.isAdmin && <AdminOverview kind={tab} />}

      {!viewer.isAdmin && done.length > 0 && (
        <section className="mb-8 space-y-3">
          {/* Notas TRI | Sem TRI */}
          <SegTabs
            active={tab}
            tabs={[
              { key: 'tri', label: 'Notas TRI', href: '/simulados', count: triDone.length },
              { key: 'sem', label: 'Sem TRI', href: '/simulados?v=sem', count: plainDone.length },
            ]}
          />

          <Card className="p-4 sm:p-6">
            <p className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
              <Trophy className="size-4 text-warning" /> {tab === 'tri' ? 'Sua nota TRI' : 'Seu % de acertos'}
            </p>
            {chart.length ? (
              tab === 'tri' ? (
                <ComboChart points={chart} min={200} ticks={[200, 400, 600, 800, 1000]} barName="Nota TRI" lineName="Evolução" />
              ) : (
                <ComboChart points={chart} min={0} max={100} ticks={[0, 25, 50, 75, 100]} barName="% de acertos" lineName="Evolução" />
              )
            ) : (
              <p className="py-8 text-center text-sm text-muted">{tab === 'tri' ? 'Nenhuma prova com TRI corrigida ainda.' : 'Nenhuma prova sem TRI corrigida ainda.'}</p>
            )}
          </Card>

          {/* Notas embaixo do gráfico: toque para ver o relatório */}
          {shown.length > 0 && (
            <ol className="overflow-hidden rounded-2xl border border-line bg-surface">
              {[...shown].reverse().map((s) => {
                const r = resBy.get(s.id)!;
                return (
                  <li key={s.id} className="border-b border-line last:border-b-0">
                    <Link href={`/simulados/${s.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-xs font-extrabold text-brand">{s.area}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{s.title}</span>
                        <span className="block text-[11px] text-muted">
                          {r.correct}/{s.question_count} acertos
                        </span>
                      </span>
                      <span className="shrink-0 text-base font-extrabold text-ink tabular-nums">
                        {tab === 'tri' ? Number(r.tri_score).toFixed(0) : `${Math.round(Number(r.accuracy))}%`}
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted" />
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}

      {toDo.length > 0 && <h2 className="mb-3 text-base font-bold text-ink">Para fazer</h2>}

      {toDo.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {toDo.map((s) => {
            const st = subBy.get(s.id);
            const r = resBy.get(s.id);
            let badge = <Badge tone="brand">Disponível</Badge>;
            if (r) badge = <Badge tone="success"><Trophy className="size-3" /> {s.use_tri === false ? `${r.correct}/${s.question_count} acertos` : `${Number(r.tri_score).toFixed(0)} pts`}</Badge>;
            else if (st === 'completed') badge = <Badge tone="warning"><Hourglass className="size-3" /> Aguardando resultado</Badge>;
            else if (st === 'in_progress') badge = <Badge tone="warning"><Clock className="size-3" /> Em andamento</Badge>;
            else if (s.results_released) badge = <Badge><Lock className="size-3" /> Encerrado</Badge>;
            return (
              <Link key={s.id} href={`/simulados/${s.id}`} className="group">
                <Card className="h-full p-5 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-brand/40 group-hover:shadow-glow">
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-sm font-extrabold text-brand">{s.area}</span>
                    {badge}
                  </div>
                  <p className="mt-4 line-clamp-2 font-bold text-ink">{s.title}</p>
                  <p className="mt-1 text-xs text-muted">{ENEM_AREAS[s.area]}</p>
                  <div className="mt-4 flex gap-4 text-xs text-ink-2">
                    <span className="flex items-center gap-1.5"><ClipboardCheck className="size-3.5" /> {s.question_count} questões</span>
                    <span className="flex items-center gap-1.5"><Clock className="size-3.5" /> {s.time_limit_minutes ? `${s.time_limit_minutes} min` : 'Tempo livre'}</span>
                  </div>
                  {r && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-success">
                      <CheckCircle2 className="size-3.5" /> {r.correct} acertos · {r.accuracy}%
                    </p>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        !simulados.length && (
          <EmptyState icon={<ClipboardCheck className="size-6" />} title="Nenhum simulado publicado" description="Quando um novo simulado for liberado ele aparece aqui." />
        )
      )}
    </>
  );
}

/** Admin: média geral de cada prova → turmas em ranking. */
async function AdminOverview({ kind }: { kind: 'tri' | 'sem' }) {
  const o = await loadOverview(kind);
  const points: ComboPoint[] = o.perSim(() => true).map((s) => ({ label: s.title, bar: s.mean, barLabel: fmt(kind, s.mean!), href: `/admin/simulados/${s.id}` }));
  const q = kind === 'sem' ? '?v=sem' : '';
  return (
    <section className="mb-8 space-y-4">
      <KindTabs kind={kind} base="/simulados" />
      <MeansChart kind={kind} title={kind === 'tri' ? 'Média geral TRI por simulado' : 'Média geral de acertos por simulado'} points={points} />
      <RankList
        title="Turmas"
        icon="users"
        items={o.classes().map((c) => ({
          key: c.id,
          href: `/simulados/turma/${c.id}${q}`,
          name: c.name,
          sub: `${c.alunos} aluno${c.alunos === 1 ? '' : 's'} · ${c.provas} prova${c.provas === 1 ? '' : 's'}`,
          value: fmt(kind, c.mean),
          unit: kind === 'tri' ? 'média TRI' : 'acertos',
        }))}
      />
    </section>
  );
}
