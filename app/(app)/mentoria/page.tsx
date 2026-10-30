import { CalendarClock, Video } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Board } from '@/components/mentoria/board';
import { buttonClass, Card as Box } from '@/components/ui';
import { emailKey } from '@/lib/db';
import { DISCIPLINES } from '@/lib/enem-matriz';
import { todayBR } from '@/lib/mentoria';
import { cards, ensureFresh, getMentoria, nextMeeting } from '@/lib/mentoria-data';
import { requireViewer } from '@/lib/session';
import { formatDateTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'Mentoria' };
const NAMES = Object.fromEntries(DISCIPLINES.map((d) => [d.key, d.name]));

/** Hoje: quadro com os assuntos do dia (estudar → questões → desempenho). */
export default async function MentoriaToday() {
  const viewer = await requireViewer();
  const m = await getMentoria(emailKey(viewer.email));
  if (!m) return null;
  if (!m.diagnosed_at) redirect('/mentoria/horarios?primeira=1');
  await ensureFresh(m.id);
  const today = todayBR();
  const [list, meeting] = await Promise.all([cards(m.id), nextMeeting(m.id)]);
  if (!list.length) {
    return <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-sm text-muted">Seu mentor está montando seu cronograma. Assim que ficar pronto, os assuntos do dia aparecem aqui.</p>;
  }
  const todays = list
    .filter((c) => c.level < 4 && c.scheduled_on !== null && c.scheduled_on <= today && !(c.last_day === today && c.step === 'study'))
    .map((c) => ({ id: c.id, discipline: NAMES[c.discipline] ?? c.discipline, title: c.title, priority: c.priority, level: c.level, step: c.step, last_acc: c.last_acc }));
  const done = list
    .filter((c) => c.last_day === today && c.step === 'study')
    .map((c) => ({ id: c.id, discipline: NAMES[c.discipline] ?? c.discipline, title: c.title, acc: c.last_acc, level: c.level, due: c.due_on }));

  return (
    <div className="space-y-4">
      {meeting && (
        <Box className="flex items-center gap-3 p-3.5">
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
        </Box>
      )}
      <Board key={todays.map((c) => c.id + c.step).join()} cards={todays} done={done} />
    </div>
  );
}
