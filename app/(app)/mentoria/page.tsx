import { CalendarClock, ChevronLeft, ChevronRight, Clock, Flag, Target, Video } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, buttonClass, Card, EmptyState, LinkButton, PageHeader } from '@/components/ui';
import { requireViewer } from '@/lib/session';
import { db, emailKey, fromDoc, fromQuery } from '@/lib/db';
import type { Mentoria, MentoriaCheckin, MentoriaMeeting, MentoriaTask } from '@/lib/types';
import { addDays, cn, formatDate, formatDateTime, weekStart } from '@/lib/utils';
import { CheckinForm } from './checkin-form';
import { TaskList } from './task-list';

export const metadata: Metadata = { title: 'Mentoria' };

export default async function MentoriaPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const viewer = await requireViewer();
  const { w } = await searchParams;
  const m = fromDoc<Mentoria>(await db().doc(`mentorias/${emailKey(viewer.email)}`).get());

  if (!m) {
    return (
      <>
        <PageHeader title="Mentoria" />
        <EmptyState
          icon={<Target className="size-6" />}
          title="Você ainda não participa da mentoria"
          description="A mentoria individual inclui plano semanal, check-ins e encontros com o professor."
          action={viewer.isAdmin ? <LinkButton href="/admin/mentoria">Gerenciar mentorias</LinkButton> : undefined}
        />
      </>
    );
  }
  const mentoria = m as Mentoria;
  const current = weekStart();
  const week = /^\d{4}-\d{2}-\d{2}$/.test(w ?? '') ? weekStart(new Date(`${w}T12:00:00`)) : current;

  const d = db();
  const since = new Date(Date.now() - 3 * 3600_000).toISOString();
  const [taskSnap, checkSnap, mineSnap, groupSnap] = await Promise.all([
    d.collection('mentoria_tasks').where('mentoria_id', '==', mentoria.id).where('week_start', '==', week).get(),
    d.collection('mentoria_checkins').where('mentoria_id', '==', mentoria.id).get(),
    d.collection('mentoria_meetings').where('mentoria_id', '==', mentoria.id).get(),
    d.collection('mentoria_meetings').where('mentoria_id', '==', null).get(),
  ]);
  const tasks = fromQuery<MentoriaTask>(taskSnap).sort(
    (a, b) => String(a.due_date ?? '9999').localeCompare(String(b.due_date ?? '9999')) || String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')),
  );
  const checkinList = fromQuery<MentoriaCheckin>(checkSnap).sort((a, b) => b.week_start.localeCompare(a.week_start)).slice(0, 12);
  const meetings = [...fromQuery<MentoriaMeeting>(mineSnap), ...fromQuery<MentoriaMeeting>(groupSnap)]
    .filter((x) => x.starts_at >= since)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, 6);
  const thisCheckin = checkinList.find((c) => c.week_start === week) ?? null;
  const history = [...checkinList].reverse().slice(-8);
  const maxH = Math.max(mentoria.weekly_hours_target, ...history.map((h) => Number(h.hours_studied)), 1);

  return (
    <>
      <PageHeader
        eyebrow="Mentoria individual"
        title={mentoria.exam_target || 'Seu plano de estudos'}
        subtitle={mentoria.goal}
        actions={
          <Badge tone={mentoria.status === 'active' ? 'success' : 'warning'}>
            {mentoria.status === 'active' ? 'Ativa' : mentoria.status === 'paused' ? 'Pausada' : 'Encerrada'}
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card className="p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-ink">Plano da semana</p>
                <p className="text-xs text-muted">
                  {formatDate(week)} – {formatDate(addDays(week, 6))}
                  {week === current && ' · semana atual'}
                </p>
              </div>
              <div className="flex gap-1">
                <Link href={`/mentoria?w=${addDays(week, -7)}`} scroll={false} className={buttonClass('secondary', 'icon', 'size-9')} aria-label="Semana anterior">
                  <ChevronLeft className="size-4" />
                </Link>
                <Link href={`/mentoria?w=${addDays(week, 7)}`} scroll={false} className={buttonClass('secondary', 'icon', 'size-9')} aria-label="Próxima semana">
                  <ChevronRight className="size-4" />
                </Link>
              </div>
            </div>
            <TaskList key={week} tasks={tasks} />
          </Card>

          <Card className="p-4 sm:p-5">
            <p className="text-sm font-bold text-ink">Check-in semanal</p>
            <p className="mb-4 text-xs text-muted">Conte como foi sua semana — o professor responde com um feedback.</p>
            <CheckinForm key={week} mentoriaId={mentoria.id} week={week} checkin={thisCheckin} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-4 sm:p-5">
            <p className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
              <Clock className="size-4 text-brand" /> Horas estudadas
            </p>
            {history.length ? (
              <div className="flex h-36 items-end gap-2">
                {history.map((h) => {
                  const v = Number(h.hours_studied);
                  return (
                    <div key={h.id} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-[10px] font-bold text-ink tabular-nums">{v}</span>
                      <div
                        className={cn('w-full rounded-t-md', v >= mentoria.weekly_hours_target ? 'bg-success' : 'bg-brand')}
                        style={{ height: `${Math.max(4, (v / maxH) * 100)}px` }}
                      />
                      <span className="text-[9px] text-muted">{formatDate(h.week_start).replace(' de', '')}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted">Seus check-ins aparecem aqui.</p>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
              <Flag className="size-3.5" /> Meta: {mentoria.weekly_hours_target} h/semana
            </p>
          </Card>

          <Card className="p-4 sm:p-5">
            <p className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
              <CalendarClock className="size-4 text-brand" /> Próximos encontros
            </p>
            {meetings.length ? (
              <ul className="space-y-3">
                {meetings.map((mt) => (
                  <li key={mt.id} className="rounded-xl border border-line bg-surface-2/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-ink">{mt.title}</p>
                      <Badge tone={mt.mentoria_id ? 'brand' : 'neutral'}>{mt.mentoria_id ? 'Individual' : 'Grupo'}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {formatDateTime(mt.starts_at)} · {mt.duration_min} min
                    </p>
                    {mt.description && <p className="mt-1 text-xs text-ink-2">{mt.description}</p>}
                    {mt.link && (
                      <a href={mt.link} target="_blank" rel="noopener noreferrer" className={buttonClass('primary', 'sm', 'mt-3 w-full')}>
                        <Video className="size-3.5" /> Entrar no encontro
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nenhum encontro agendado.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
