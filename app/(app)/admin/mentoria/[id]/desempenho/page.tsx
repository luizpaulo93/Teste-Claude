import { notFound } from 'next/navigation';
import { MentoriaPerformance } from '@/components/mentoria/performance';
import { todayBR } from '@/lib/mentoria';
import { getMentoria, recentSessions, simuladoScores, weekTasks } from '@/lib/mentoria-data';
import { weekStart } from '@/lib/utils';

export default async function AdminMentoradoPerf({ params }: { params: Promise<{ id: string }> }) {
  const m = await getMentoria(decodeURIComponent((await params).id));
  if (!m) notFound();
  const week = weekStart(new Date(`${todayBR()}T12:00:00`));
  const [sessions, tasks, sims] = await Promise.all([recentSessions(m.id, 70), weekTasks(m.id, week), simuladoScores(m.student_email)]);
  return <MentoriaPerformance mentoria={m} sessions={sessions} tasks={tasks} simulados={sims} simuladoHref={(id) => `/admin/simulados/${id}`} />;
}
