import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { sql } from '@/lib/db';
import type { Mentoria, MentoriaMeeting } from '@/lib/types';
import { todayBR } from '@/lib/mentoria';
import { MentoriaList } from './mentoria-list';

export const metadata: Metadata = { title: 'Mentoria · Admin' };

export default async function AdminMentoria() {
  const since = new Date(Date.now() - 86400_000).toISOString();
  const [list, meetings, stats] = await Promise.all([
    sql.query<Mentoria>(`select * from mentorias order by lower(coalesce(nullif(student_name, ''), student_email))`),
    sql.query<MentoriaMeeting>(`select * from mentoria_meetings where mentoria_id is null and starts_at >= $1 order by starts_at`, [since]),
    // Sinais de atenção: último desempenho marcado, mensagens não lidas e assuntos estudados
    sql.query<{ id: string; last_study: string | null; unread: number; studied: number; total: number }>(
      `select m.id,
              (select max(c.history -> -1 ->> 'd') from mentoria_cards c where c.mentoria_id = m.id) as last_study,
              (select count(*)::int from mentoria_messages x where x.mentoria_id = m.id and not x.from_mentor and x.read_at is null) as unread,
              (select count(*)::int from mentoria_cards c where c.mentoria_id = m.id and c.level > 0) as studied,
              (select count(*)::int from mentoria_cards c where c.mentoria_id = m.id) as total
         from mentorias m`,
    ),
  ]);
  const today = todayBR();
  const signals = Object.fromEntries(
    stats.map((x) => [
      x.id,
      {
        idleDays: x.last_study ? Math.round((new Date(`${today}T12:00:00Z`).getTime() - new Date(`${x.last_study}T12:00:00Z`).getTime()) / 86400000) : null,
        unread: x.unread,
        studied: x.studied,
        total: x.total,
      },
    ]),
  );
  return (
    <>
      <PageHeader title="Mentoria" subtitle="Monte o cronograma por assuntos e acompanhe em que parte cada aluno está." />
      <MentoriaList mentorias={list} groupMeetings={meetings} signals={signals} />
    </>
  );
}
