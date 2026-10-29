import type { Metadata } from 'next';
import { CalendarView, type Birthday } from '@/components/calendar/calendar-view';
import { holidays } from '@/lib/calendar';
import { sql } from '@/lib/db';
import { requireViewer } from '@/lib/session';
import type { CalendarEvent } from '@/lib/types';
import { toISODate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Calendário' };

/** "Ana Beatriz Costa" → "Ana C." (aniversários sem expor o nome completo) */
function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0] || 'Aluno';
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ d?: string; m?: string }> }) {
  const viewer = await requireViewer();
  const { d, m } = await searchParams;
  // ?d=AAAA-MM-DD abre num dia; ?m=AAAA-MM (links antigos) abre no mês
  const initial = /^\d{4}-\d{2}-\d{2}$/.test(d ?? '') ? d! : /^\d{4}-\d{2}$/.test(m ?? '') ? `${m}-01` : toISODate(new Date());
  const year = Number(initial.slice(0, 4));

  // Ano inteiro + bordas (dias de dez/jan que aparecem na grade)
  const from = `${year - 1}-12-01`;
  const to = `${year + 1}-01-31`;
  const [rows, people] = await Promise.all([
    sql.query<CalendarEvent>(
      `select * from calendar_events where end_date >= $1 and start_date <= $2 and (is_published or $3) order by start_date limit 2000`,
      [from, to, viewer.isAdmin],
    ),
    // Aniversários: o admin vê todos os alunos; o aluno vê os colegas da turma e o próprio
    sql.query<{ id: string; name: string; birth: string }>(
      `select s.id, coalesce(nullif(s.name, ''), split_part(s.email, '@', 1)) as name, to_char(s.birth_date, 'MM-DD') as birth
         from students s
        where s.birth_date is not null and s.status = 'active' and ($1 or (s.class_id is not null and s.class_id = $2) or s.id = $3)
       union
       select u.id, u.full_name, to_char(u.birth_date, 'MM-DD') from users u where u.id = $4 and u.birth_date is not null
       limit 3000`,
      [viewer.isAdmin, viewer.student?.class_id ?? null, viewer.student?.id ?? '', viewer.userId],
    ),
  ]);

  const seen = new Set<string>();
  const birthdays: Birthday[] = people
    .filter((p) => p.birth && !seen.has(p.name + p.birth) && seen.add(p.name + p.birth))
    .map((p) => ({ id: p.id, name: viewer.isAdmin ? p.name : shortName(p.name), md: p.birth }));

  const events = [...rows, ...holidays(year - 1), ...holidays(year), ...holidays(year + 1)].filter((e) => e.end_date >= from && e.start_date <= to);

  return <CalendarView year={year} initialDate={initial} events={events} birthdays={birthdays} isAdmin={viewer.isAdmin} />;
}
