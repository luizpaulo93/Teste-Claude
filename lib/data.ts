import 'server-only';
import { cache } from 'react';
import { createClient } from './supabase/server';
import type { CalendarEvent, Course, Lesson, LessonProgress, Module } from './types';

export const LESSON_LIST_COLUMNS = 'id,module_id,course_id,title,duration,thumbnail_url,youtube_id,position,is_free';

export type LessonSummary = Pick<
  Lesson,
  'id' | 'module_id' | 'course_id' | 'title' | 'duration' | 'thumbnail_url' | 'youtube_id' | 'position' | 'is_free'
>;

/** Catálogo publicado + aulas visíveis ao usuário (a RLS filtra). Uma ida ao banco por tabela, em paralelo. */
export const getCatalog = cache(async () => {
  const supabase = await createClient();
  const [{ data: courses }, { data: lessons }] = await Promise.all([
    supabase.from('courses').select('*').eq('is_published', true).order('position').order('created_at'),
    supabase.from('lessons').select('id,course_id').eq('is_published', true),
  ]);
  const lessonCount = new Map<string, number>();
  (lessons ?? []).forEach((l: { course_id: string }) => lessonCount.set(l.course_id, (lessonCount.get(l.course_id) ?? 0) + 1));
  return { courses: (courses ?? []) as Course[], lessonCount };
});

export const getMyProgress = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('lesson_progress')
    .select('lesson_id,course_id,completed,position_sec,duration_sec,updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1000);
  return (data ?? []) as LessonProgress[];
});

export const getCourseTree = cache(async (courseId: string) => {
  const supabase = await createClient();
  const [{ data: course }, { data: modules }, { data: lessons }] = await Promise.all([
    supabase.from('courses').select('*').eq('id', courseId).maybeSingle(),
    supabase.from('modules').select('*').eq('course_id', courseId).eq('is_published', true).order('position').order('created_at'),
    supabase
      .from('lessons')
      .select(LESSON_LIST_COLUMNS)
      .eq('course_id', courseId)
      .eq('is_published', true)
      .order('position')
      .order('created_at'),
  ]);
  return {
    course: course as Course | null,
    modules: (modules ?? []) as Module[],
    lessons: (lessons ?? []) as LessonSummary[],
  };
});

export const getUpcomingEvents = cache(async (limit = 5) => {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from('calendar_events')
    .select('*')
    .gte('end_date', today)
    .order('start_date')
    .limit(limit);
  return (data ?? []) as CalendarEvent[];
});

export function courseProgress(courseId: string, total: number, progress: LessonProgress[]) {
  if (!total) return 0;
  const done = progress.filter((p) => p.course_id === courseId && p.completed).length;
  return Math.round((done / total) * 100);
}
