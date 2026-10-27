import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import type { Mentoria, MentoriaCheckin, MentoriaMeeting, MentoriaTask } from '@/lib/types';
import { weekStart } from '@/lib/utils';
import { MentoriaDetail } from './mentoria-detail';

export const metadata: Metadata = { title: 'Mentorado · Admin' };

export default async function AdminMentoriaDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ w?: string }> }) {
  const [{ id }, { w }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const week = /^\d{4}-\d{2}-\d{2}$/.test(w ?? '') ? weekStart(new Date(`${w}T12:00:00`)) : weekStart();
  const supabase = await createClient();
  const [{ data: m }, { data: tasks }, { data: checkins }, { data: meetings }] = await Promise.all([
    supabase.from('mentorias').select('*').eq('id', id).maybeSingle(),
    supabase.from('mentoria_tasks').select('*').eq('mentoria_id', id).eq('week_start', week).order('created_at'),
    supabase.from('mentoria_checkins').select('*').eq('mentoria_id', id).order('week_start', { ascending: false }).limit(20),
    supabase.from('mentoria_meetings').select('*').eq('mentoria_id', id).order('starts_at', { ascending: false }).limit(20),
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
        tasks={(tasks ?? []) as MentoriaTask[]}
        checkins={(checkins ?? []) as MentoriaCheckin[]}
        meetings={(meetings ?? []) as MentoriaMeeting[]}
      />
    </>
  );
}
