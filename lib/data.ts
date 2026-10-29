import 'server-only';
import { cache } from 'react';
import { getCatalogData, getSettings, sql, type LessonSummary } from './db';
import { canSeeLesson, type Viewer } from './session';
import type { CalendarEvent, Course, LessonProgress } from './types';

export type { LessonSummary } from './db';

/** Cursos publicados + aulas publicadas de cada curso (vem do cache, sem custo de leitura). */
export const getCatalog = cache(async () => {
  const { courses, modules, lessons } = await getCatalogData();
  const published = courses.filter((c) => c.is_published);
  const openModules = new Set(modules.filter((m) => m.is_published).map((m) => m.id));
  // Aulas distintas por curso (uma aula pode estar em mais de um módulo)
  const courseLessons = new Map<string, Set<string>>();
  lessons.forEach((l) => {
    if (!l.is_published || !openModules.has(l.module_id)) return;
    if (!courseLessons.has(l.course_id)) courseLessons.set(l.course_id, new Set());
    courseLessons.get(l.course_id)!.add(l.id);
  });
  const lessonCount = new Map([...courseLessons].map(([k, v]) => [k, v.size]));
  return { courses: published, lessonCount, courseLessons };
});

/** Aulas que este usuário pode ver (publicada, em módulo visível, e liberada ou grátis). Uma linha por módulo onde a aula está. */
export async function visibleLessons(viewer: Viewer, filter?: (l: LessonSummary) => boolean) {
  const [{ courses, modules, lessons }, settings] = await Promise.all([getCatalogData(), getSettings()]);
  const byId = new Map(courses.map((c) => [c.id, c]));
  const openModules = new Set(modules.filter((m) => m.is_published || viewer.isAdmin).map((m) => m.id));
  return lessons.filter(
    (l) => (!filter || filter(l)) && openModules.has(l.module_id) && canSeeLesson(viewer, l, byId.get(l.course_id), settings.restrict_to_student_list),
  );
}

/**
 * Onde o aluno pode assistir esta aula. Prefere o curso pedido (?c=) e devolve null se não tiver acesso.
 * Admin pode abrir qualquer aula, mesmo fora de cursos (só no banco de aulas).
 */
export async function lessonPlacement(viewer: Viewer, lessonId: string, preferCourse?: string) {
  const list = await visibleLessons(viewer, (l) => l.id === lessonId);
  return list.find((l) => l.course_id === preferCourse) ?? list[0] ?? null;
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

/** % de aulas concluídas de um curso (conta pelas aulas, então vale mesmo se a aula estiver em vários cursos). */
export function courseProgress(lessonIds: Set<string> | undefined, progress: LessonProgress[]) {
  if (!lessonIds?.size) return 0;
  const done = progress.filter((p) => p.completed && lessonIds.has(p.lesson_id)).length;
  return Math.round((done / lessonIds.size) * 100);
}
