import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import { getMentoria } from '@/lib/mentoria-data';
import type { MentoriaCheckin, MentoriaMeeting, MentoriaTask } from '@/lib/types';
import { weekStart } from '@/lib/utils';
import { MentoriaDetail } from './mentoria-detail';

export const metadata: Metadata = { title: 'Mentorado · Admin' };

export default async function AdminMentoriaDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ w?: string }> }) {
  const [{ id }, { w }] = await Promise.all([params, searchParams]);
  const week = /^\d{4}-\d{2}-\d{2}$/.test(w ?? '') ? weekStart(new Date(`${w}T12:00:00`)) : weekStart();
  const mid = decodeURIComponent(id);
  const [m, tasks, checkins, meetings] = await Promise.all([
    getMentoria(mid),
    sql.query<MentoriaTask>(`select * from mentoria_tasks where mentoria_id = $1 and week_start = $2 order by due_date nulls last, created_at`, [mid, week]),
    sql.query<MentoriaCheckin>(`select * from mentoria_checkins where mentoria_id = $1 order by week_start desc limit 20`, [mid]),
    sql.query<MentoriaMeeting>(`select * from mentoria_meetings where mentoria_id = $1 order by starts_at desc limit 20`, [mid]),
  ]);
  if (!m) notFound();
  return <MentoriaDetail key={week} mentoria={m} week={week} tasks={tasks} checkins={checkins} meetings={meetings} />;
}
