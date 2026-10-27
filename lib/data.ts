import 'server-only';
import { cache } from 'react';
import { db, fromQuery, getCatalogData, getSettings, stateDocPath, type LessonSummary } from './db';
import { canSeeLesson, type Viewer } from './session';
import type { CalendarEvent, Course, LessonProgress } from './types';

export type { LessonSummary } from './db';

/** Cursos publicados + nº de aulas publicadas por curso (vem do cache, sem custo de leitura). */
export const getCatalog = cache(async () => {
  const { courses, lessons } = await getCatalogData();
  const published = courses.filter((c) => c.is_published);
  const lessonCount = new Map<string, number>();
  lessons.forEach((l) => l.is_published && lessonCount.set(l.course_id, (lessonCount.get(l.course_id) ?? 0) + 1));
  return { courses: published, lessonCount };
});

/** Aulas que este usuário pode ver (mesma regra de antes: publicada e liberada, ou grátis). */
export async function visibleLessons(viewer: Viewer, filter?: (l: LessonSummary) => boolean) {
  const [{ courses, lessons }, settings] = await Promise.all([getCatalogData(), getSettings()]);
  const byId = new Map(courses.map((c) => [c.id, c]));
  return lessons.filter((l) => (!filter || filter(l)) && canSeeLesson(viewer, l, byId.get(l.course_id), settings.restrict_to_student_list));
}

/**
 * Progresso e favoritos do aluno ficam num ÚNICO documento (users/{uid}/state/main):
 * 1 leitura por página, não importa quantas aulas ele já assistiu.
 */
export const getMyState = cache(async (userId: string) => {
  const data = ((await db().doc(stateDocPath(userId)).get()).data() ?? {}) as {
    progress?: Record<string, Partial<LessonProgress>>;
    favorites?: Record<string, string>;
  };
  const progress: LessonProgress[] = Object.entries(data.progress ?? {})
    .filter(([, v]) => v && typeof v === 'object')
    .map(([lesson_id, v]) => ({
      lesson_id,
      course_id: String(v.course_id ?? ''),
      completed: v.completed === true,
      position_sec: Number(v.position_sec) || 0,
      duration_sec: Number(v.duration_sec) || 0,
      updated_at: String(v.updated_at ?? ''),
    }))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const favorites = Object.entries(data.favorites ?? {})
    .map(([lesson_id, at]) => ({ lesson_id, created_at: String(at) }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { progress, favorites };
});

export const getMyProgress = cache(async (userId: string) => (await getMyState(userId)).progress);

export const getCourseTree = cache(async (courseId: string, viewer: Viewer) => {
  const { courses, modules } = await getCatalogData();
  const course = (courses.find((c) => c.id === courseId) ?? null) as Course | null;
  if (!course || (!course.is_published && !viewer.isAdmin)) return { course: null, modules: [], lessons: [] as LessonSummary[] };
  return {
    course,
    modules: modules.filter((m) => m.course_id === courseId && (m.is_published || viewer.isAdmin)),
    lessons: await visibleLessons(viewer, (l) => l.course_id === courseId),
  };
});

export const getUpcomingEvents = cache(async (limit = 5) => {
  const today = new Date().toISOString().slice(0, 10);
  const snap = await db().collection('calendar_events').where('end_date', '>=', today).orderBy('end_date').limit(50).get();
  return fromQuery<CalendarEvent>(snap)
    .filter((e) => e.is_published)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, limit);
});

export function courseProgress(courseId: string, total: number, progress: LessonProgress[]) {
  if (!total) return 0;
  const done = progress.filter((p) => p.course_id === courseId && p.completed).length;
  return Math.round((done / total) * 100);
}
