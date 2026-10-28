import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { sql } from '@/lib/db';
import type { Mentoria, MentoriaCheckin, MentoriaMeeting, MentoriaTask } from '@/lib/types';
import { weekStart } from '@/lib/utils';
import { MentoriaDetail } from './mentoria-detail';

export const metadata: Metadata = { title: 'Mentorado · Admin' };

export default async function AdminMentoriaDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ w?: string }> }) {
  const [{ id }, { w }] = await Promise.all([params, searchParams]);
  if (!id || id.includes('/') || id.length > 200) notFound();
  const week = /^\d{4}-\d{2}-\d{2}$/.test(w ?? '') ? weekStart(new Date(`${w}T12:00:00`)) : weekStart();
  const mid = decodeURIComponent(id);
  const [m, tasks, checkins, meetings] = await Promise.all([
    sql.one<Mentoria>(`select * from mentorias where id = $1`, [mid]),
    sql.query<MentoriaTask>(`select * from mentoria_tasks where mentoria_id = $1 and week_start = $2 order by created_at`, [mid, week]),
    sql.query<MentoriaCheckin>(`select * from mentoria_checkins where mentoria_id = $1 order by week_start desc limit 20`, [mid]),
    sql.query<MentoriaMeeting>(`select * from mentoria_meetings where mentoria_id = $1 order by starts_at desc limit 20`, [mid]),
  ]);
  if (!m) notFound();
  return (
    <>
      <Link href="/admin/mentoria" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Mentoria
      </Link>
      <PageHeader title={(m as Mentoria).student_name || (m as Mentoria).student_email} subtitle={(m as Mentoria).exam_target || (m as Mentoria).student_email} />
      <MentoriaDetail
        key={week}
        mentoria={m as Mentoria}
        week={week}
        tasks={tasks}
        checkins={checkins}
        meetings={meetings}
      />
    </>
  );
}
