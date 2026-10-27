import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import type { CalendarEvent } from '@/lib/types';
import { EventsManager } from './events-manager';

export const metadata: Metadata = { title: 'Calendário · Admin' };

export default async function AdminCalendar() {
  const supabase = await createClient();
  const since = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
  const { data } = await supabase.from('calendar_events').select('*').gte('end_date', since).order('start_date').limit(300);
  return (
    <>
      <PageHeader title="Calendário" subtitle="Eventos aparecem para todos os alunos. Feriados nacionais são automáticos." />
      <EventsManager events={(data ?? []) as CalendarEvent[]} />
    </>
  );
}
