import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AssuntoPicker } from '@/components/mentoria/assunto-picker';
import { PlanBuilder } from '@/components/mentoria/plan-builder';
import { TrailBoard } from '@/components/mentoria/trail-board';
import { Card } from '@/components/ui';
import { todayBR } from '@/lib/mentoria';
import { boardData, ensureFresh, getMentoria, planEnd } from '@/lib/mentoria-data';
import { ASSUNTOS, DISCIPLINES } from '@/lib/trilha-catalog';
import { cn, formatDate } from '@/lib/utils';
import { MentoriaAdminCard } from './admin-card';

export const metadata: Metadata = { title: 'Mentorado · Admin' };

const STAGES = [
  { label: 'Teoria', dot: 'bg-zinc-400' },
  { label: 'Nível 1', dot: 'bg-sky-400' },
  { label: 'Nível 2', dot: 'bg-amber-400' },
  { label: 'Nível 3', dot: 'bg-orange-500' },
  { label: 'Dominado', dot: 'bg-emerald-500' },
];

/**
 * Área do mentor: a trilha do aluno num quadro (como o Trello). Tudo anda sozinho (listas, retenção,
 * revisões); o mentor acompanha pelos alertas e, se quiser, arrasta um assunto para outra etapa.
 */
export default async function AdminMentoriaTrail({ params }: { params: Promise<{ id: string }> }) {
  const m = await getMentoria(decodeURIComponent((await params).id));
  if (!m) notFound();
  await ensureFresh(m.id);
  const { cards, weekly } = await boardData(m.id);
  const today = todayBR();
  const total = cards.length;
  const by = [0, 1, 2, 3, 4].map((l) => cards.filter((c) => c.level === l).length);
  const out = cards.filter((c) => c.level === 0 && !c.scheduled).length;
  const used = DISCIPLINES.filter((d) => cards.some((c) => c.discipline === d.key)).map((d) => ({ key: d.key, name: d.name }));
  const disciplines = DISCIPLINES.map((d) => {
    const all = ASSUNTOS.filter((a) => a.discipline === d.key);
    return { key: d.key, name: d.name, count: all.length, top: all.filter((a) => a.priority >= 3).length };
  });
  const end = planEnd(m, today);

  return (
    <div className="space-y-4">
      {total > 0 && (
        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Progresso da trilha</p>
              <p className="num mt-1 text-3xl font-medium text-ink">
                {Math.round((by[4] / total) * 100)}%<span className="ml-2 text-sm font-normal text-muted">dominado</span>
              </p>
            </div>
            <p className="text-xs text-muted">
              {total} assuntos · agenda até {formatDate(end)}
              {out > 0 && <span className="text-warning"> · {out} não cabem no período (aumente os horários ou o período)</span>}
            </p>
          </div>
          <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-surface-3">
            {by.map((n, l) => (
              <span key={l} className={cn('h-full', STAGES[l].dot)} style={{ width: `${(n / total) * 100}%` }} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
            {STAGES.map((s, l) => (
              <span key={s.label} className="flex items-center gap-1.5 text-xs text-ink-2">
                <span className={cn('size-2 rounded-full', s.dot)} />
                {s.label} <span className="num text-muted">{by[l]}</span>
              </span>
            ))}
          </div>
        </Card>
      )}

      {total > 0 ? (
        <TrailBoard mentoriaId={m.id} cards={cards} disciplines={used} today={today} />
      ) : (
        <p className="rounded-xl border border-dashed border-line-strong p-8 text-center text-sm text-muted">
          Escolha as disciplinas ou os assuntos abaixo para montar a trilha do aluno.
        </p>
      )}

      {weekly.length > 0 && (
        <Card className="p-4 sm:p-5">
          <p className="text-sm font-semibold text-ink">Revisões da semana</p>
          <p className="mt-0.5 text-xs text-muted">Assuntos já estudados que voltaram porque nenhuma lista da disciplina os levou.</p>
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
            {weekly.map((w) => (
              <li key={w.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                <span className="min-w-0 flex-1 text-ink-2">
                  {w.discipline} · {w.q} questões
                </span>
                <span className="num text-ink">{w.status === 'open' ? 'aberta' : `${w.ok ?? 0}/${w.total ?? 0}`}</span>
                <span className="num w-14 text-right text-muted">{formatDate(w.at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-4 sm:p-5">
        <details className="group" open={total === 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 select-none [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block text-sm font-semibold text-ink">Montar a trilha</span>
              <span className="block text-xs text-muted">
                {m.scope === 'especifica' ? 'Escolha os assuntos da mentoria específica' : 'Disciplinas inteiras na ordem certa, ou assuntos escolhidos à mão'}
              </span>
            </span>
            <span className="text-xs font-medium text-muted group-open:hidden">Abrir</span>
          </summary>
          <div className="mt-4 space-y-6">
            {m.scope !== 'especifica' && (
              <PlanBuilder mentoriaId={m.id} disciplines={disciplines} chosen={m.plan_disciplines} order={m.plan_order} hasSchedule={Boolean(m.diagnosed_at)} />
            )}
            <AssuntoPicker key={cards.length + cards.map((c) => c.key).join().length} mentoriaId={m.id} selected={cards.map((c) => c.key)} />
          </div>
        </details>
      </Card>
      <MentoriaAdminCard mentoria={m} />
    </div>
  );
}
