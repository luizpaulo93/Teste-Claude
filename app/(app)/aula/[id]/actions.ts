'use server';

import { authorOf } from '@/lib/author';
import { db, getCatalogData, nowIso } from '@/lib/db';
import { canSeeLesson, getSettings, getViewer } from '@/lib/session';
import type { Lesson, LessonComment } from '@/lib/types';
import { isDocId } from '@/lib/utils';

/** Plano B quando o navegador não está logado no Firebase (ex.: dados do site apagados): grava pelo servidor. */
export async function saveProgressServer(lessonId: string, courseId: string, patch: { completed?: boolean; position_sec?: number; duration_sec?: number }) {
  const viewer = await getViewer();
  if (!viewer || !isDocId(lessonId) || !isDocId(courseId)) return { error: 'Sessão expirada.' };
  const clean: Record<string, unknown> = { lesson_id: lessonId, course_id: courseId, updated_at: nowIso() };
  if (typeof patch.completed === 'boolean') clean.completed = patch.completed;
  if (Number.isFinite(patch.position_sec)) clean.position_sec = Math.max(0, Math.floor(patch.position_sec!));
  if (Number.isFinite(patch.duration_sec)) clean.duration_sec = Math.max(0, Math.floor(patch.duration_sec!));
  await db().doc(`users/${viewer.userId}/progress/${lessonId}`).set(clean, { merge: true });
  return { ok: true };
}

export async function setFavoriteServer(lessonId: string, value: boolean) {
  const viewer = await getViewer();
  if (!viewer || !isDocId(lessonId)) return { error: 'Sessão expirada.' };
  const ref = db().doc(`users/${viewer.userId}/favorites/${lessonId}`);
  if (value) await ref.set({ lesson_id: lessonId, created_at: nowIso() });
  else await ref.delete();
  return { ok: true };
}


export async function addComment(lessonId: string, text: string): Promise<{ error?: string; comment?: LessonComment }> {
  const viewer = await getViewer();
  const body = text.trim().slice(0, 2000);
  if (!viewer || !isDocId(lessonId) || !body) return { error: 'Não foi possível enviar.' };
  const [snap, settings, catalog] = await Promise.all([db().doc(`lessons/${lessonId}`).get(), getSettings(), getCatalogData()]);
  const lesson = snap.data() as Lesson | undefined;
  if (!lesson || !canSeeLesson(viewer, lesson, catalog.courses.find((c) => c.id === lesson.course_id), settings.restrict_to_student_list))
    return { error: 'Sem acesso a esta aula.' };
  const ref = db().collection(`lessons/${lessonId}/comments`).doc();
  const comment = { lesson_id: lessonId, author_id: viewer.userId, text: body, created_at: nowIso(), ...authorOf(viewer) };
  await ref.set(comment);
  return { comment: { id: ref.id, ...comment } };
}

export async function deleteComment(lessonId: string, commentId: string) {
  const viewer = await getViewer();
  if (!viewer || !isDocId(lessonId) || !isDocId(commentId)) return { error: 'Sessão expirada.' };
  const ref = db().doc(`lessons/${lessonId}/comments/${commentId}`);
  const snap = await ref.get();
  if (!snap.exists) return { ok: true };
  if (snap.data()?.author_id !== viewer.userId && !viewer.isAdmin) return { error: 'Sem permissão.' };
  await ref.delete();
  return { ok: true };
}
