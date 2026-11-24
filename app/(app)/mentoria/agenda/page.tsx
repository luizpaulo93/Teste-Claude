import { CalendarClock, Video } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Checks } from '@/components/mentoria/checks';
import { DayList } from '@/components/mentoria/day-list';
import { checksOf } from '@/lib/mentoria-checks';
import { buttonClass, Card } from '@/components/ui';
import { emailKey, sql } from '@/lib/db';
import { blocksOf, blocksOnDay, spacesOfMentoria } from '@/lib/mentoria-blocks';
import { dayData, ensureFresh, getMentoria, nextMeeting, weekData } from '@/lib/mentoria-data';
import { ViewToggle } from '@/components/mentoria/view-toggle';
import { WeekGrid, WeekSummary } from '@/components/mentoria/week-view';
import { requireViewer } from '@/lib/session';
import { formatDateTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'Agenda · Mentoria' };

/** Cronograma do dia: abre em hoje; escolhe outro dia da semana para ver os assuntos. */
export default async function MentoriaAgenda({ searchParams }: { searchParams: Promise<{ d?: string; v?: string }> }) {
  const viewer = await requireViewer();
  const m = await getMentoria(emailKey(viewer.email));
  if (!m) return null;
  const [has, blocks, checks] = await Promise.all([
    sql.one(`select 1 from mentoria_cards where mentoria_id = $1 limit 1`, [m.id]),
    spacesOfMentoria(m.id).then(blocksOf),
    checksOf(m.id),
  ]);
  if (!has && !blocks.length) {
    return (
      <div className="space-y-4">
        <Checks checks={checks} />
        <p className="rounded-xl border border-dashed border-line-strong p-8 text-center text-sm text-muted">Seu cronograma está sendo montado.</p>
      </div>
    );
  }
  await ensureFresh(m.id);
  const sp = await searchParams;
  const view = sp.v === 'dia' ? 'dia' : 'semana';
  const [data, meeting, week] = await Promise.all([dayData(m, sp.d), nextMeeting(m.id), view === 'semana' ? weekData(m, sp.d) : null]);
  return (
    <div className="space-y-4">
      {!m.availability.some(Boolean) && (
        <Link href="/mentoria/horarios" className="block rounded-xl border border-brand/40 bg-brand/10 p-3.5 text-sm text-ink">
          <strong>Informe seus horários</strong> para os assuntos se distribuírem nos seus dias de estudo →
        </Link>
      )}
      {meeting && data.day === data.today && (
        <Card className="flex items-center gap-3 p-3.5">
          <CalendarClock className="size-5 shrink-0 text-brand" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{meeting.title}</p>
            <p className="text-xs text-muted">{formatDateTime(meeting.starts_at)}</p>
          </div>
          {meeting.link && (
            <a href={meeting.link} target="_blank" rel="noopener noreferrer" className={buttonClass('primary', 'sm')}>
              <Video className="size-3.5" /> Entrar
            </a>
          )}
        </Card>
      )}
      <Checks checks={checks} />
      <ViewToggle view={view} day={data.day} />
      {week && (
        <>
          <WeekSummary summary={week.summary} monday={week.monday} today={week.today} hoursHref="/mentoria/horarios" />
          <WeekGrid today={week.today} week={week.week} selected={data.day} days={week.days} basePath="/mentoria/agenda" />
        </>
      )}
      <DayList key={data.day + data.items.map((i) => i.id + i.step).join()} {...data} folder={blocksOnDay(blocks, data.day)} strip={view === 'dia'} />
    </div>
  );
}
