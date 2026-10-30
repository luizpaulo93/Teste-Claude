import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { sql } from '@/lib/db';
import type { Mentoria, MentoriaMeeting } from '@/lib/types';
import { weekStart } from '@/lib/utils';
import { todayBR } from '@/lib/mentoria';
import { MentoriaList } from './mentoria-list';

export const metadata: Metadata = { title: 'Mentoria · Admin' };

export default async function AdminMentoria() {
  const week = weekStart();
  const since = new Date(Date.now() - 86400_000).toISOString();
  const [list, checks, meetings, stats] = await Promise.all([
    sql.query<Mentoria>(`select * from mentorias order by lower(coalesce(nullif(student_name, ''), student_email))`),
    sql.query<{ mentoria_id: string; mentor_feedback: string }>(`select mentoria_id, mentor_feedback from mentoria_checkins where week_start = $1`, [week]),
    sql.query<MentoriaMeeting>(`select * from mentoria_meetings where mentoria_id is null and starts_at >= $1 order by starts_at`, [since]),
    // Sinais de atenção: último estudo, mensagens não lidas e tarefas da semana
    sql.query<{ id: string; last_study: string | null; unread: number; done: number; total: number }>(
      `select m.id,
              (select max(studied_on)::text from mentoria_sessions s where s.mentoria_id = m.id) as last_study,
              (select count(*)::int from mentoria_messages x where x.mentoria_id = m.id and not x.from_mentor and x.read_at is null) as unread,
              (select count(*)::int from mentoria_tasks t where t.mentoria_id = m.id and t.week_start = $1 and t.done) as done,
              (select count(*)::int from mentoria_tasks t where t.mentoria_id = m.id and t.week_start = $1) as total
         from mentorias m`,
      [week],
    ),
  ]);
  const today = todayBR();
  const signals = Object.fromEntries(
    stats.map((x) => [
      x.id,
      {
        idleDays: x.last_study ? Math.round((new Date(`${today}T12:00:00Z`).getTime() - new Date(`${x.last_study}T12:00:00Z`).getTime()) / 86400000) : null,
        unread: x.unread,
        tasks: x.total ? Math.round((x.done / x.total) * 100) : null,
      },
    ]),
  );
  const weekly = new Map(checks.map((c) => [c.mentoria_id, c.mentor_feedback ? 'respondido' : 'pendente']));
  return (
    <>
      <PageHeader title="Mentoria" subtitle="Diagnóstico, cronograma, desempenho, caderno de erros e conversa com cada aluno." />
      <MentoriaList mentorias={list} weekly={Object.fromEntries(weekly)} groupMeetings={meetings} signals={signals} />
    </>
  );
}
