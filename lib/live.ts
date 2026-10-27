import 'server-only';
import { db, fromQuery, getCatalogData, getSettings } from './db';
import { canAccessCourse, type Viewer } from './session';
import type { LiveSession } from './types';

/** Mesma regra de antes: admin vê tudo; aluno liberado vê as lives do curso dele (ou de todos). */
export async function canSeeLive(viewer: Viewer, live: LiveSession) {
  if (viewer.isAdmin) return true;
  if (!live.is_published || !viewer.isMember) return false;
  if (!live.course_id) return true;
  const [{ courses }, settings] = await Promise.all([getCatalogData(), getSettings()]);
  const course = courses.find((c) => c.id === live.course_id);
  return Boolean(course && canAccessCourse(viewer, course, settings.restrict_to_student_list));
}

export async function visibleLives(viewer: Viewer, statuses?: LiveSession['status'][]) {
  if (!viewer.isMember) return [];
  let q: FirebaseFirestore.Query = db().collection('live_sessions');
  if (statuses?.length === 1) q = q.where('status', '==', statuses[0]);
  else if (statuses?.length) q = q.where('status', 'in', statuses);
  const list = fromQuery<LiveSession>(await q.limit(300).get());
  const ok = await Promise.all(list.map((l) => canSeeLive(viewer, l)));
  return list.filter((_, i) => ok[i]).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
}
