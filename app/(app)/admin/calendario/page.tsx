import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { sql } from '@/lib/db';
import type { CalendarEvent } from '@/lib/types';
import { EventsManager } from './events-manager';

export const metadata: Metadata = { title: 'Calendário · Admin' };

export default async function AdminCalendar() {
  const since = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
  const data = await sql.query<CalendarEvent>(`select * from calendar_events where end_date >= $1 order by start_date limit 300`, [since]);
  return (
    <>
      <PageHeader title="Calendário" subtitle="Eventos aparecem para todos os alunos. Feriados nacionais são automáticos." />
      <EventsManager events={data} />
    </>
  );
}
