import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import type { Mentoria, MentoriaMeeting } from '@/lib/types';
import { weekStart } from '@/lib/utils';
import { MentoriaList } from './mentoria-list';

export const metadata: Metadata = { title: 'Mentoria · Admin' };

export default async function AdminMentoria() {
  const supabase = await createClient();
  const week = weekStart();
  const [{ data: list }, { data: checkins }, { data: meetings }] = await Promise.all([
    supabase.from('mentorias').select('*').order('student_name'),
    supabase.from('mentoria_checkins').select('mentoria_id,mentor_feedback').eq('week_start', week),
    supabase.from('mentoria_meetings').select('*').is('mentoria_id', null).gte('starts_at', new Date(Date.now() - 86400_000).toISOString()).order('starts_at'),
  ]);
  const weekly = new Map((checkins ?? []).map((c: { mentoria_id: string; mentor_feedback: string }) => [c.mentoria_id, c.mentor_feedback ? 'respondido' : 'pendente']));
  return (
    <>
      <PageHeader title="Mentoria" subtitle="Acompanhe cada aluno com plano semanal, check-ins e encontros." />
      <MentoriaList mentorias={(list ?? []) as Mentoria[]} weekly={Object.fromEntries(weekly)} groupMeetings={(meetings ?? []) as MentoriaMeeting[]} />
    </>
  );
}
