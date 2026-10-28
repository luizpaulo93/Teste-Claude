import { isDocId } from '@/lib/utils';
import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Card, PageHeader, Stat } from '@/components/ui';
import { sql } from '@/lib/db';
import { ENEM_AREAS, type Simulado, type SimuladoResult, type SimuladoStats, type SimuladoSubmission } from '@/lib/types';
import { cn, formatClock } from '@/lib/utils';
import { SimuladoAdminActions, ResetButton } from './simulado-admin-actions';

export const metadata: Metadata = { title: 'Simulado · Admin' };

export default async function AdminSimulado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isDocId(id)) notFound();
  const [simulado, key, submissions, results, profs] = await Promise.all([
    sql.one<Simulado>(`select * from simulados where id = $1`, [id]),
    sql.one<{ answer_key: string }>(`select answer_key from simulado_keys where simulado_id = $1`, [id]),
    sql.query<SimuladoSubmission>(`select * from simulado_submissions where simulado_id = $1`, [id]),
    sql.query<Pick<SimuladoResult, 'user_id' | 'correct' | 'tri_score' | 'coherence' | 'accuracy'>>(
      `select user_id, correct, tri_score, coherence, accuracy from simulado_results where simulado_id = $1`,
      [id],
    ),
    sql.query<{ id: string; full_name: string; email: string }>(
      `select u.id, u.full_name, u.email from users u join simulado_submissions s on s.user_id = u.id where s.simulado_id = $1`,
      [id],
    ),
  ]);
  if (!simulado) notFound();
  const resBy = new Map(results.map((r) => [r.user_id, r]));
  const profBy = new Map(profs.map((p) => [p.id, p]));
  const stats = simulado.stats as SimuladoStats;
  const answerKey = key?.answer_key ?? '';

  // Acertos brutos (antes de liberar) para o admin acompanhar
  const rawCorrect = (answers: string) => [...answers].filter((c, i) => c !== '-' && c === answerKey[i]).length;
  const rows = submissions
    .map((s) => ({ s, p: profBy.get(s.user_id), r: resBy.get(s.user_id) }))
    .sort((a, b) => (Number(b.r?.tri_score ?? -1) - Number(a.r?.tri_score ?? -1)) || rawCorrect(b.s.answers) - rawCorrect(a.s.answers));
  const completed = submissions.filter((s) => s.status === 'completed').length;

  return (
    <>
      <Link href="/admin/simulados" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Simulados
      </Link>
      <PageHeader
        eyebrow={ENEM_AREAS[simulado.area]}
        title={simulado.title}
        subtitle={`${simulado.question_count} questões · ${simulado.time_limit_minutes ? `${simulado.time_limit_minutes} min` : 'tempo livre'}${answerKey.length === simulado.question_count ? '' : ' · ⚠ gabarito incompleto'}`}
        actions={<SimuladoAdminActions simulado={simulado} answerKey={answerKey} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Entregas" value={completed} hint={`${submissions.length - completed} em andamento`} />
        <Stat label="Média TRI" value={simulado.results_released && stats?.meanTri ? stats.meanTri.toFixed(1) : '—'} />
        <Stat label="Média de acertos" value={simulado.results_released && stats?.meanCorrect !== undefined ? stats.meanCorrect : '—'} />
        <Stat label="Status" value={<span className="text-base">{simulado.results_released ? 'Resultados liberados' : simulado.is_published ? 'Aberto' : 'Rascunho'}</span>} />
      </div>

      {simulado.results_released && stats?.items?.length > 0 && (
        <Card className="mt-6 p-4 sm:p-5">
          <p className="mb-4 text-sm font-bold text-ink">Acerto por questão</p>
          <div className="flex h-32 items-end gap-[3px] overflow-x-auto">
            {stats.items.map((it) => (
              <div key={it.q} className="group relative flex min-w-[10px] flex-1 flex-col items-center justify-end" title={`Q${it.q}: ${it.hitPct}%`}>
                <div
                  className={cn('w-full rounded-t-sm', it.tier === 'easy' ? 'bg-success' : it.tier === 'medium' ? 'bg-warning' : 'bg-danger')}
                  style={{ height: `${Math.max(3, it.hitPct)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-4 text-[11px] text-muted">
            <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-success" /> fácil</span>
            <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-warning" /> média</span>
            <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-danger" /> difícil</span>
          </div>
        </Card>
      )}

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-line p-4 sm:p-5">
          <p className="text-sm font-bold text-ink">Participantes</p>
        </div>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2/60 text-left text-xs font-semibold text-muted">
                  <th className="px-4 py-3">#</th>
                  <th className="px-2 py-3">Aluno</th>
                  <th className="px-2 py-3">Status</th>
                  <th className="px-2 py-3">Tempo</th>
                  <th className="px-2 py-3">Acertos</th>
                  <th className="px-2 py-3">TRI</th>
                  <th className="px-2 py-3">Coerência</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ s, p, r }, i) => (
                  <tr key={s.id} className="hover:bg-surface-2/50">
                    <td className="px-4 py-3 text-xs text-muted tabular-nums">{i + 1}</td>
                    <td className="px-2 py-3">
                      <p className="font-semibold text-ink">{p?.full_name || '—'}</p>
                      <p className="text-xs text-muted">{p?.email}</p>
                    </td>
                    <td className="px-2 py-3">
                      <Badge tone={s.status === 'completed' ? 'success' : 'warning'}>{s.status === 'completed' ? 'Entregue' : 'Fazendo'}</Badge>
                    </td>
                    <td className="px-2 py-3 text-xs tabular-nums">{s.status === 'completed' ? formatClock(s.duration_seconds) : '—'}</td>
                    <td className="px-2 py-3 font-semibold tabular-nums">{r ? r.correct : answerKey ? rawCorrect(s.answers) : '—'}</td>
                    <td className="px-2 py-3 font-bold text-brand tabular-nums">{r ? Number(r.tri_score).toFixed(1) : '—'}</td>
                    <td className="px-2 py-3 tabular-nums">{r ? `${r.coherence}%` : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <ResetButton simuladoId={simulado.id} userId={s.user_id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-5 text-sm text-muted">Ninguém iniciou este simulado ainda.</p>
        )}
      </Card>
    </>
  );
}
