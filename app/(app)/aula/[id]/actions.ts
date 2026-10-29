'use server';

import { authorOf } from '@/lib/author';
import { lessonPlacement } from '@/lib/data';
import { newId, sql } from '@/lib/db';
import { getViewer, type Viewer } from '@/lib/session';
import type { LessonComment } from '@/lib/types';
import { isDocId } from '@/lib/utils';

/** Grava a posição do vídeo / aula concluída (chamado a cada 30 s enquanto o vídeo toca). */
export async function saveProgressServer(lessonId: string, courseId: string, patch: { completed?: boolean; position_sec?: number; duration_sec?: number }) {
  const viewer = await getViewer();
  if (!viewer || !isDocId(lessonId) || !isDocId(courseId)) return { error: 'Sessão expirada.' };
  const completed = typeof patch.completed === 'boolean' ? patch.completed : null;
  const pos = Number.isFinite(patch.position_sec) ? Math.max(0, Math.min(2e9, Math.floor(patch.position_sec!))) : null;
  const dur = Number.isFinite(patch.duration_sec) ? Math.max(0, Math.min(2e9, Math.floor(patch.duration_sec!))) : null;
  await sql.exec(
    `insert into lesson_progress (user_id, lesson_id, course_id, completed, position_sec, duration_sec, updated_at)
     values ($1, $2, $3, coalesce($4, false), coalesce($5, 0), coalesce($6, 0), now())
     on conflict (user_id, lesson_id) do update set
       course_id = excluded.course_id,
       completed = coalesce($4, lesson_progress.completed),
       position_sec = coalesce($5, lesson_progress.position_sec),
       duration_sec = coalesce($6, lesson_progress.duration_sec),
       updated_at = now()`,
    [viewer.userId, lessonId, courseId, completed, pos, dur],
  );
  return { ok: true };
}

export async function setFavoriteServer(lessonId: string, value: boolean) {
  const viewer = await getViewer();
  if (!viewer || !isDocId(lessonId)) return { error: 'Sessão expirada.' };
  if (value) await sql.exec(`insert into favorites (user_id, lesson_id) values ($1, $2) on conflict do nothing`, [viewer.userId, lessonId]);
  else await sql.exec(`delete from favorites where user_id = $1 and lesson_id = $2`, [viewer.userId, lessonId]);
  return { ok: true };
}

/** O usuário pode ver esta aula em algum curso? */
async function lessonFor(viewer: Viewer, lessonId: string) {
  return (await lessonPlacement(viewer, lessonId)) ?? (viewer.isAdmin ? { id: lessonId } : null);
}

export async function addComment(lessonId: string, text: string): Promise<{ error?: string; comment?: LessonComment }> {
  const viewer = await getViewer();
  const body = text.trim().slice(0, 2000);
  if (!viewer || !isDocId(lessonId) || !body) return { error: 'Não foi possível enviar.' };
  if (!(await lessonFor(viewer, lessonId))) return { error: 'Sem acesso a esta aula.' };
  const a = authorOf(viewer);
  const comment = await sql.one<LessonComment>(
    `insert into lesson_comments (id, lesson_id, author_id, author_name, author_avatar, author_role, text)
     values ($1, $2, $3, $4, $5, $6, $7) returning *`,
    [newId(), lessonId, viewer.userId, a.author_name, a.author_avatar, a.author_role, body],
  );
  return comment ? { comment } : { error: 'Não foi possível enviar.' };
}

export async function deleteComment(lessonId: string, commentId: string) {
  const viewer = await getViewer();
  if (!viewer || !isDocId(lessonId) || !isDocId(commentId)) return { error: 'Sessão expirada.' };
  const row = await sql.one<{ author_id: string }>(`select author_id from lesson_comments where id = $1 and lesson_id = $2`, [commentId, lessonId]);
  if (!row) return { ok: true };
  if (row.author_id !== viewer.userId && !viewer.isAdmin) return { error: 'Sem permissão.' };
  await sql.exec(`delete from lesson_comments where id = $1`, [commentId]);
  return { ok: true };
}

export async function moreComments(lessonId: string, before: string): Promise<LessonComment[]> {
  const viewer = await getViewer();
  if (!viewer || !isDocId(lessonId) || !before) return [];
  if (!(await lessonFor(viewer, lessonId))) return [];
  return sql.query<LessonComment>(
    `select * from lesson_comments where lesson_id = $1 and created_at < $2 order by created_at desc limit 30`,
    [lessonId, before],
  );
}
