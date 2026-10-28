import 'server-only';
import { cache } from 'react';
import { getCatalogData, getSettings, sql, type LessonSummary } from './db';
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

/** Progresso e favoritos do aluno (2 consultas leves, em paralelo). */
export const getMyState = cache(async (userId: string) => {
  const [progress, favorites] = await Promise.all([
    sql.query<LessonProgress>(
      `select lesson_id, course_id, completed, position_sec, duration_sec, updated_at
         from lesson_progress where user_id = $1 order by updated_at desc limit 3000`,
      [userId],
    ),
    sql.query<{ lesson_id: string; created_at: string }>(
      `select lesson_id, created_at from favorites where user_id = $1 order by created_at desc limit 1000`,
      [userId],
    ),
  ]);
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
  return sql.query<CalendarEvent>(
    `select * from calendar_events where end_date >= $1 and is_published order by start_date limit $2`,
    [today, limit],
  );
});

export function courseProgress(courseId: string, total: number, progress: LessonProgress[]) {
  if (!total) return 0;
  const done = progress.filter((p) => p.course_id === courseId && p.completed).length;
  return Math.round((done / total) * 100);
}
