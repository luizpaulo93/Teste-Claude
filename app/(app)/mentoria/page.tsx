import { CalendarClock, Video } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { DayList } from '@/components/mentoria/day-list';
import { buttonClass, Card } from '@/components/ui';
import { emailKey, sql } from '@/lib/db';
import { dayData, ensureFresh, getMentoria, nextMeeting } from '@/lib/mentoria-data';
import { requireViewer } from '@/lib/session';
import { formatDateTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'Mentoria' };

/** Cronograma do dia: abre em hoje; escolhe outro dia da semana para ver os assuntos. */
export default async function MentoriaToday({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const viewer = await requireViewer();
  const m = await getMentoria(emailKey(viewer.email));
  if (!m) return null;
  const has = await sql.one(`select 1 from mentoria_cards where mentoria_id = $1 limit 1`, [m.id]);
  if (!has) {
    return <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-sm text-muted">Seu mentor está montando seu cronograma. Assim que ficar pronto, os assuntos de cada dia aparecem aqui.</p>;
  }
  await ensureFresh(m.id);
  const [data, meeting] = await Promise.all([dayData(m, (await searchParams).d), nextMeeting(m.id)]);
  return (
    <div className="space-y-4">
      {!m.availability.some(Boolean) && (
        <Link href="/mentoria/horarios" className="block rounded-2xl border border-brand/40 bg-brand/10 p-3.5 text-sm text-ink">
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
      <DayList key={data.day + data.items.map((i) => i.id + i.step).join()} {...data} />
    </div>
  );
}
