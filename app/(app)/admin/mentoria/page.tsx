import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { db, fromQuery } from '@/lib/db';
import type { Mentoria, MentoriaMeeting } from '@/lib/types';
import { weekStart } from '@/lib/utils';
import { MentoriaList } from './mentoria-list';

export const metadata: Metadata = { title: 'Mentoria · Admin' };

export default async function AdminMentoria() {
  const d = db();
  const week = weekStart();
  const since = new Date(Date.now() - 86400_000).toISOString();
  const [listSnap, checkSnap, meetSnap] = await Promise.all([
    d.collection('mentorias').get(),
    d.collection('mentoria_checkins').where('week_start', '==', week).get(),
    d.collection('mentoria_meetings').where('mentoria_id', '==', null).get(),
  ]);
  const list = fromQuery<Mentoria>(listSnap).sort((a, b) => (a.student_name || a.student_email).localeCompare(b.student_name || b.student_email));
  const weekly = new Map(checkSnap.docs.map((c) => [String(c.get('mentoria_id')), c.get('mentor_feedback') ? 'respondido' : 'pendente']));
  const meetings = fromQuery<MentoriaMeeting>(meetSnap)
    .filter((m) => m.starts_at >= since)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return (
    <>
      <PageHeader title="Mentoria" subtitle="Acompanhe cada aluno com plano semanal, check-ins e encontros." />
      <MentoriaList mentorias={list} weekly={Object.fromEntries(weekly)} groupMeetings={meetings} />
    </>
  );
}
