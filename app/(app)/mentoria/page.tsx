import { BookX, CalendarClock, ChevronRight, Clock, Flame, ListChecks, Video } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { QuestionsLog } from '@/components/mentoria/questions-log';
import { StudyTimer } from '@/components/mentoria/study-timer';
import { WeekPlan } from '@/components/mentoria/week-plan';
import { buttonClass, Card } from '@/components/ui';
import { emailKey, sql } from '@/lib/db';
import { fmtMinutes, streak, todayBR } from '@/lib/mentoria';
import { getMentoria, recentSessions, upcomingMeetings, weekTasks } from '@/lib/mentoria-data';
import { requireViewer } from '@/lib/session';
import { formatDateTime, weekStart } from '@/lib/utils';

export const metadata: Metadata = { title: 'Mentoria' };

/** Hoje: o que estudar agora, cronômetro e registro de questões. */
export default async function MentoriaToday() {
  const viewer = await requireViewer();
  const m = await getMentoria(emailKey(viewer.email));
  if (!m) return null;
  if (!m.diagnosed_at) redirect('/mentoria/diagnostico?primeira=1');
  const today = todayBR();
  const week = weekStart(new Date(`${today}T12:00:00`));
  const [tasks, sessions, meetings, due] = await Promise.all([
    weekTasks(m.id, week),
    recentSessions(m.id, 40),
    upcomingMeetings(m.id),
    sql.one<{ n: number }>(`select count(*)::int as n from mentoria_errors where mentoria_id = $1 and not mastered and next_review <= $2`, [m.id, today]),
  ]);
  const todays = tasks.filter((t) => t.due_date === today || (!t.due_date && !t.done));
  const todayMin = sessions.filter((s) => s.studied_on === today).reduce((a, s) => a + s.minutes, 0);
  const todayQ = sessions.filter((s) => s.studied_on === today).reduce((a, s) => a + s.questions, 0);
  const days = streak(sessions);
  const next = meetings[0];
  const nextSubject = todays.find((t) => !t.done && t.subject)?.subject;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <MiniStat icon={<Clock className="size-4" />} value={fmtMinutes(todayMin)} label="estudados hoje" />
          <MiniStat icon={<ListChecks className="size-4" />} value={String(todayQ)} label="questões hoje" />
          <MiniStat icon={<Flame className="size-4" />} value={`${days}`} label={days === 1 ? 'dia seguido' : 'dias seguidos'} />
        </div>

        <Card className="p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-ink">Para hoje</p>
            <Link href="/mentoria/plano" className="flex items-center gap-0.5 text-xs font-semibold text-brand">
              Semana <ChevronRight className="size-3.5" />
            </Link>
          </div>
          {todays.length ? (
            <WeekPlan tasks={todays} week={week} today={today} canGenerate={false} />
          ) : (
            <div className="space-y-3 rounded-xl bg-surface-2/60 p-4 text-sm text-muted">
              <p>Nada planejado para hoje.</p>
              {!tasks.length && (
                <Link href="/mentoria/plano" className={buttonClass('primary', 'sm')}>
                  Montar meu cronograma
                </Link>
              )}
            </div>
          )}
        </Card>

        {(due?.n ?? 0) > 0 && (
          <Link href="/mentoria/erros" className="flex items-center gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 transition hover:bg-warning/15">
            <BookX className="size-5 shrink-0 text-warning" />
            <span className="min-w-0 flex-1 text-sm font-semibold text-ink">
              {due!.n} erro{due!.n === 1 ? '' : 's'} para revisar hoje
            </span>
            <ChevronRight className="size-4 text-muted" />
          </Link>
        )}

        {next && (
          <Card className="flex items-center gap-3 p-4">
            <CalendarClock className="size-5 shrink-0 text-brand" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{next.title}</p>
              <p className="text-xs text-muted">{formatDateTime(next.starts_at)}</p>
            </div>
            {next.link && (
              <a href={next.link} target="_blank" rel="noopener noreferrer" className={buttonClass('primary', 'sm')}>
                <Video className="size-3.5" /> Entrar
              </a>
            )}
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <Card className="p-4 sm:p-5">
          <StudyTimer defaultSubject={nextSubject} />
        </Card>
        <Card className="p-4 sm:p-5">
          <QuestionsLog />
        </Card>
      </div>
    </div>
  );
}

function MiniStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3 text-center">
      <span className="mx-auto mb-1 grid size-7 place-items-center rounded-lg bg-brand/12 text-brand">{icon}</span>
      <p className="text-lg font-extrabold text-ink tabular-nums">{value}</p>
      <p className="text-[10px] leading-tight text-muted">{label}</p>
    </div>
  );
}
