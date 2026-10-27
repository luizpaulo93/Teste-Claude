import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { db, fromQuery } from '@/lib/db';
import type { CalendarEvent } from '@/lib/types';
import { EventsManager } from './events-manager';

export const metadata: Metadata = { title: 'Calendário · Admin' };

export default async function AdminCalendar() {
  const since = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
  const snap = await db().collection('calendar_events').where('end_date', '>=', since).orderBy('end_date').limit(300).get();
  const data = fromQuery<CalendarEvent>(snap).sort((a, b) => a.start_date.localeCompare(b.start_date));
  return (
    <>
      <PageHeader title="Calendário" subtitle="Eventos aparecem para todos os alunos. Feriados nacionais são automáticos." />
      <EventsManager events={data} />
    </>
  );
}
