import 'server-only';
import { unstable_cache } from 'next/cache';
import { emailKey, getCatalogData, getSettings, sql } from './db';
import { canUseSpace } from './mentoria-space';
import { canAccessCourse, type Viewer } from './session';
import type { LiveMessage, LiveSession } from './types';

/** Admin vê tudo; aluno liberado vê as lives do curso dele (ou as abertas a todos). */
export async function canSeeLive(viewer: Viewer, live: LiveSession & { space?: string | null }) {
  if (viewer.isAdmin) return true;
  if (!live.is_published) return false;
  // Público escolhido: turmas, alunos, mentorias (individual ou grupo) ou cursos
  if (live.audience?.length) {
    for (const t of live.audience) if (await audienceMatch(viewer, t)) return true;
    return false;
  }
  // Live só da mentoria: apenas quem participa daquela mentoria
  if (live.space) return canUseSpace(viewer, live.space);
  if (!viewer.isMember) return false;
  if (!live.course_id) return true;
  const [{ courses }, settings] = await Promise.all([getCatalogData(), getSettings()]);
  const course = courses.find((c) => c.id === live.course_id);
  return Boolean(course && canAccessCourse(viewer, course, settings.restrict_to_student_list));
}

async function audienceMatch(viewer: Viewer, token: string) {
  const [kind, ...rest] = token.split(':');
  const id = rest.join(':');
  if (!id) return false;
  if (kind === 'c') return viewer.student?.status === 'active' && viewer.student.class_id === id;
  if (kind === 'u') return emailKey(viewer.email) === id;
  if (kind === 'm' || kind === 'g') return canUseSpace(viewer, token);
  if (kind === 'course') {
    if (!viewer.isMember) return false;
    const [{ courses }, settings] = await Promise.all([getCatalogData(), getSettings()]);
    const course = courses.find((c) => c.id === id);
    return Boolean(course && canAccessCourse(viewer, course, settings.restrict_to_student_list));
  }
  return false;
}

/** Lives agendadas e no ar, em cache (renovado quando o admin agenda, inicia ou encerra uma live). */
const activeLives = unstable_cache(
  () => sql.query<LiveSession>(`select * from live_sessions where status <> 'ended' order by starts_at desc limit 300`),
  ['lives-active-v1'],
  { tags: ['lives'], revalidate: 60 },
);

export async function visibleLives(viewer: Viewer, statuses?: LiveSession['status'][]) {
  // (aluno escolhido pelo nome pode assistir mesmo sem turma)
  const onlyActive = statuses?.length && !statuses.includes('ended');
  const list = onlyActive
    ? (await activeLives()).filter((l) => statuses!.includes(l.status))
    : statuses?.length
      ? await sql.query<LiveSession>(`select * from live_sessions where status = any($1) order by starts_at desc limit 300`, [statuses])
      : await sql.query<LiveSession>(`select * from live_sessions order by starts_at desc limit 300`);
  const ok = await Promise.all(list.map((l) => canSeeLive(viewer, l)));
  return list.filter((_, i) => ok[i]);
}

/** Status + últimas 100 mensagens de uma live, com cache curto compartilhado entre todos os alunos. */
export function liveFeed(liveId: string) {
  return unstable_cache(
    async () => {
      const [live, messages] = await Promise.all([
        sql.one<LiveSession>(`select * from live_sessions where id = $1`, [liveId]),
        sql.query<LiveMessage>(`select * from (select * from live_messages where live_id = $1 order by created_at desc limit 100) m order by created_at`, [liveId]),
      ]);
      return { live, messages };
    },
    ['live-feed', liveId],
    { tags: [`live-${liveId}`], revalidate: 2 },
  )();
}
