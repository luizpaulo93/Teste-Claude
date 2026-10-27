import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { db, fromDoc, fromQuery } from '@/lib/db';
import type { Mentoria, MentoriaCheckin, MentoriaMeeting, MentoriaTask } from '@/lib/types';
import { weekStart } from '@/lib/utils';
import { MentoriaDetail } from './mentoria-detail';

export const metadata: Metadata = { title: 'Mentorado · Admin' };

export default async function AdminMentoriaDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ w?: string }> }) {
  const [{ id }, { w }] = await Promise.all([params, searchParams]);
  if (!id || id.includes('/') || id.length > 200) notFound();
  const week = /^\d{4}-\d{2}-\d{2}$/.test(w ?? '') ? weekStart(new Date(`${w}T12:00:00`)) : weekStart();
  const d = db();
  const [mSnap, taskSnap, checkSnap, meetSnap] = await Promise.all([
    d.doc(`mentorias/${decodeURIComponent(id)}`).get(),
    d.collection('mentoria_tasks').where('mentoria_id', '==', decodeURIComponent(id)).where('week_start', '==', week).get(),
    d.collection('mentoria_checkins').where('mentoria_id', '==', decodeURIComponent(id)).get(),
    d.collection('mentoria_meetings').where('mentoria_id', '==', decodeURIComponent(id)).get(),
  ]);
  const m = fromDoc<Mentoria>(mSnap);
  if (!m) notFound();
  const tasks = fromQuery<MentoriaTask>(taskSnap).sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')));
  const checkins = fromQuery<MentoriaCheckin>(checkSnap).sort((a, b) => b.week_start.localeCompare(a.week_start)).slice(0, 20);
  const meetings = fromQuery<MentoriaMeeting>(meetSnap).sort((a, b) => b.starts_at.localeCompare(a.starts_at)).slice(0, 20);
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
