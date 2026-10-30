import type { Metadata } from 'next';
import { MentoriaPerformance } from '@/components/mentoria/performance';
import { emailKey } from '@/lib/db';
import { todayBR } from '@/lib/mentoria';
import { getMentoria, recentSessions, simuladoScores, weekTasks } from '@/lib/mentoria-data';
import { requireViewer } from '@/lib/session';
import { weekStart } from '@/lib/utils';

export const metadata: Metadata = { title: 'Desempenho · Mentoria' };

export default async function MentoriaPerf() {
  const viewer = await requireViewer();
  const m = await getMentoria(emailKey(viewer.email));
  if (!m) return null;
  const week = weekStart(new Date(`${todayBR()}T12:00:00`));
  const [sessions, tasks, sims] = await Promise.all([recentSessions(m.id, 70), weekTasks(m.id, week), simuladoScores(m.student_email)]);
  return <MentoriaPerformance mentoria={m} sessions={sessions} tasks={tasks} simulados={sims} simuladoHref={(id) => `/simulados/${id}`} />;
}
