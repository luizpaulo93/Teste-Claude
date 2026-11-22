import { CalendarDays, Trophy } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AllSubjects, MentoriaLists, ReviewButton } from '@/components/mentoria/student-panel';
import { Card } from '@/components/ui';
import { emailKey } from '@/lib/db';
import { ensureFresh, getMentoria, studentPanel } from '@/lib/mentoria-data';
import { requireViewer } from '@/lib/session';

export const metadata: Metadata = { title: 'Mentoria' };

/** Painel do aluno: como está, o que fazer hoje, revisão, todos os assuntos do ENEM com a fase e as listas. */
export default async function MentoriaPanel() {
  const viewer = await requireViewer();
  const m = await getMentoria(emailKey(viewer.email));
  if (!m) return null;
  await ensureFresh(m.id);
  const p = await studentPanel(m);
  const s = p.stats;
  const pct = s.total ? Math.round((s.mastered / s.total) * 100) : 0;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
        <Kpi label="Dominados" value={`${s.mastered}/${s.total}`} hint={`${pct}% da trilha`} />
        <Kpi label="Em andamento" value={String(s.doing)} hint={s.hard ? `${s.hard} com reforço` : 'nos níveis 1 a 3'} />
        <Kpi label="Acerto nas listas" value={s.accuracy === null ? '—' : `${s.accuracy}%`} hint={`${s.answered} questões`} />
        <Kpi label="Últimos 7 dias" value={String(s.week)} hint="questões resolvidas" />
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="flex flex-col gap-3 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <CalendarDays className="size-4 text-muted" /> Hoje
          </p>
          <p className="text-sm text-ink-2">
            {s.todayTasks ? `${s.todayTasks} ${s.todayTasks === 1 ? 'tarefa' : 'tarefas'} na sua agenda (teoria, listas e revisões).` : 'Nada pendente para hoje.'}
          </p>
          <Link href="/mentoria/agenda" className="mt-auto text-sm font-medium text-brand">
            Abrir a agenda →
          </Link>
        </Card>
        <Card className="flex flex-col gap-3 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Trophy className="size-4 text-muted" /> Revisão
          </p>
          <p className="text-sm text-ink-2">
            {s.reviewQuestions || s.reviewSubjects
              ? `${s.reviewQuestions} questões que você errou já podem voltar · ${s.reviewSubjects} assuntos na hora de revisar.`
              : 'Tudo em dia. Revise quando quiser com o que já estudou.'}
          </p>
          <ReviewButton disciplines={p.disciplines} className="mt-auto self-start" />
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-[-0.015em] text-ink">Todos os assuntos do ENEM</h2>
        <AllSubjects subjects={p.subjects} disciplines={p.disciplines} />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-[-0.015em] text-ink">Listas da mentoria</h2>
        <MentoriaLists lists={p.lists} />
      </section>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-surface px-4 py-3.5">
      <p className="font-mono text-[10.5px] tracking-[0.06em] text-muted uppercase">{label}</p>
      <p className="num mt-1.5 text-2xl font-medium text-ink">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted">{hint}</p>
    </div>
  );
}
