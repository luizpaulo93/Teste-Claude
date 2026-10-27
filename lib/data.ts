import 'server-only';
import { cache } from 'react';
import { db, fromQuery, getCatalogData, getSettings, type LessonSummary } from './db';
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

export const getMyProgress = cache(async (userId: string) => {
  const snap = await db().collection(`users/${userId}/progress`).orderBy('updated_at', 'desc').limit(1000).get();
  return snap.docs.map((d) => ({ lesson_id: d.id, ...d.data() }) as LessonProgress);
});

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
