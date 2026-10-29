import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ComboChart } from '@/components/charts/combo-chart';
import { Card } from '@/components/ui';
import { getCatalogData, sql } from '@/lib/db';
import { requireViewer } from '@/lib/session';
import type { SimuladoResult } from '@/lib/types';
import { cn, isDocId } from '@/lib/utils';

export const metadata: Metadata = { title: 'Desempenho do aluno' };

const TIER = { easy: 'Fáceis', medium: 'Médias', hard: 'Difíceis' } as const;

/** Desempenho de um aluno em todos os simulados (admin vê qualquer aluno; o aluno vê só o próprio). */
export default async function StudentPerformance({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer();
  const uid = id === 'eu' ? viewer.userId : id;
  if (!isDocId(uid) || (!viewer.isAdmin && uid !== viewer.userId)) notFound();

  const [person, results, catalog] = await Promise.all([
    sql.one<{ name: string; email: string; class_id: string | null }>(
      `select coalesce(nullif(st.name, ''), nullif(u.full_name, ''), split_part(u.email, '@', 1)) as name, u.email, st.class_id
         from users u left join students st on st.email = u.email where u.id = $1`,
      [uid],
    ),
    sql.query<SimuladoResult & { title: string; class_mean: number | null; use_tri: boolean; question_count: number }>(
      `select r.*, s.title, s.use_tri, s.question_count,
              (select avg(r2.tri_score) from simulado_results r2 where r2.simulado_id = r.simulado_id) as class_mean
         from simulado_results r join simulados s on s.id = r.simulado_id
        where r.user_id = $1 and s.results_released order by s.created_at`,
      [uid],
    ),
    getCatalogData(),
  ]);
  if (!person) notFound();
  const turma = catalog.classes.find((c) => c.id === person.class_id)?.name ?? 'Sem turma';

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href="/desempenho" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Desempenho
      </Link>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{uid === viewer.userId ? 'Seu desempenho' : person.name}</h1>
        <p className="text-sm text-muted">
          {turma}
          {viewer.isAdmin && ` · ${person.email}`}
        </p>
      </div>

      {results.length ? (
        <>
          <Card className="p-4 sm:p-5">
            <ComboChart
              points={results.filter((r) => r.use_tri !== false).map((r) => ({ label: r.title, bar: Number(r.tri_score) }))}
              barName="Nota TRI"
              lineName="Evolução"
            />
          </Card>

          {results.map((r) => (
            <details key={r.simulado_id} className="group rounded-2xl border border-line bg-surface shadow-card">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 p-4 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1 truncate font-bold text-ink">{r.title}</span>
                <span className="text-sm font-extrabold text-ink tabular-nums">
                  {r.use_tri === false ? `${r.correct}/${r.question_count}` : Number(r.tri_score).toFixed(1)}
                </span>
                <span className="text-xs text-muted tabular-nums">
                  {r.use_tri === false ? 'sem TRI · só acertos' : `${r.correct} acertos · coerência ${Math.round(Number(r.coherence))}%`}
                </span>
              </summary>
              <div className="space-y-4 border-t border-line p-4">
                {r.use_tri !== false && <div className="grid grid-cols-3 gap-2">
                  {(['easy', 'medium', 'hard'] as const).map((t) => (
                    <div key={t} className="rounded-xl bg-surface-2 p-3 text-center">
                      <p className="text-[11px] font-semibold text-muted">{TIER[t]}</p>
                      <p className="text-lg font-extrabold text-ink tabular-nums">
                        {r.tiers?.[t]?.correct ?? 0}/{r.tiers?.[t]?.total ?? 0}
                      </p>
                    </div>
                  ))}
                </div>}
                <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
                  {(r.breakdown ?? []).map((b) => (
                    <div
                      key={b.q}
                      title={`Questão ${b.q}: marcou ${b.marked}, gabarito ${b.official}`}
                      className={cn('rounded-lg border p-1.5 text-center text-[11px] tabular-nums', b.ok ? 'border-success/40 bg-success/10' : b.marked === '-' ? 'border-line bg-surface-2' : 'border-danger/40 bg-danger/10')}
                    >
                      <p className="font-bold text-ink">{b.q}</p>
                      <p className={b.ok ? 'text-success' : 'text-danger'}>
                        {b.marked}
                        {!b.ok && <span className="text-muted">/{b.official}</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </>
      ) : (
        <Card className="p-6 text-sm text-muted">Nenhum simulado com nota liberada ainda.</Card>
      )}
    </div>
  );
}
