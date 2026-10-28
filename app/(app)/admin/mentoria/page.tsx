import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { sql } from '@/lib/db';
import type { Mentoria, MentoriaMeeting } from '@/lib/types';
import { weekStart } from '@/lib/utils';
import { MentoriaList } from './mentoria-list';

export const metadata: Metadata = { title: 'Mentoria · Admin' };

export default async function AdminMentoria() {
  const week = weekStart();
  const since = new Date(Date.now() - 86400_000).toISOString();
  const [list, checks, meetings] = await Promise.all([
    sql.query<Mentoria>(`select * from mentorias order by lower(coalesce(nullif(student_name, ''), student_email))`),
    sql.query<{ mentoria_id: string; mentor_feedback: string }>(`select mentoria_id, mentor_feedback from mentoria_checkins where week_start = $1`, [week]),
    sql.query<MentoriaMeeting>(`select * from mentoria_meetings where mentoria_id is null and starts_at >= $1 order by starts_at`, [since]),
  ]);
  const weekly = new Map(checks.map((c) => [c.mentoria_id, c.mentor_feedback ? 'respondido' : 'pendente']));
  return (
    <>
      <PageHeader title="Mentoria" subtitle="Acompanhe cada aluno com plano semanal, check-ins e encontros." />
      <MentoriaList mentorias={list} weekly={Object.fromEntries(weekly)} groupMeetings={meetings} />
    </>
  );
}
