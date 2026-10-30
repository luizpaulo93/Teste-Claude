import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { sql } from '@/lib/db';
import type { Mentoria, MentoriaMeeting } from '@/lib/types';
import { todayBR } from '@/lib/mentoria';
import { pendingDoubts } from '@/lib/mentoria-space';
import { MentoriaList } from './mentoria-list';

export const metadata: Metadata = { title: 'Mentoria · Admin' };

export default async function AdminMentoria() {
  const since = new Date(Date.now() - 86400_000).toISOString();
  const [list, meetings, stats, groups, students, classes, pending] = await Promise.all([
    sql.query<Mentoria>(`select * from mentorias where group_id is null order by lower(coalesce(nullif(student_name, ''), student_email))`),
    sql.query<MentoriaMeeting>(`select * from mentoria_meetings where mentoria_id is null and starts_at >= $1 order by starts_at`, [since]),
    // Sinais de atenção: último desempenho marcado, mensagens não lidas e assuntos estudados
    sql.query<{ id: string; last_study: string | null; unread: number; studied: number; total: number }>(
      `select m.id,
              (select max(c.history -> -1 ->> 'd') from mentoria_cards c where c.mentoria_id = m.id) as last_study,
              0 as unread,
              (select count(*)::int from mentoria_cards c where c.mentoria_id = m.id and c.level > 0) as studied,
              (select count(*)::int from mentoria_cards c where c.mentoria_id = m.id) as total
         from mentorias m`,
    ),
    sql.query<{ id: string; name: string; exam_target: string; members: number }>(
      `select g.id, g.name, g.exam_target,
              (select count(*)::int from mentorias m where m.group_id = g.id) as members
         from mentoria_groups g order by g.name`,
    ),
    sql.query<{ email: string; name: string; class_id: string | null }>(
      `select email, coalesce(nullif(name, ''), email) as name, class_id from students order by lower(coalesce(nullif(name, ''), email)) limit 5000`,
    ),
    sql.query<{ id: string; name: string; count: number }>(
      `select c.id, c.name, (select count(*)::int from students s where s.class_id = c.id and s.status = 'active') as count from classes c order by c.name`,
    ),
    pendingDoubts(),
  ]);
  const today = todayBR();
  const signals = Object.fromEntries(
    stats.map((x) => [
      x.id,
      {
        idleDays: x.last_study ? Math.round((new Date(`${today}T12:00:00Z`).getTime() - new Date(`${x.last_study}T12:00:00Z`).getTime()) / 86400000) : null,
        unread: pending.get(`m:${x.id}`) ?? 0,
        studied: x.studied,
        total: x.total,
      },
    ]),
  );
  return (
    <>
      <PageHeader title="Mentoria" subtitle="Monte o cronograma por assuntos e acompanhe em que parte cada aluno está." />
      <MentoriaList
        mentorias={list}
        groupMeetings={meetings}
        signals={signals}
        groups={groups.map((g) => ({ ...g, pending: pending.get(`g:${g.id}`) ?? 0 }))}
        students={students}
        classes={classes}
      />
    </>
  );
}
