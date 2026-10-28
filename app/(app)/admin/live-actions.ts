'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { bool, fail, requireAdminAction, str, type ActionResult } from '@/lib/admin/guard';
import { newId, sql } from '@/lib/db';
import { extractYoutubeId, isDocId } from '@/lib/utils';

function refresh(id?: string) {
  if (id) updateTag(`live-${id}`);
  revalidatePath('/admin/ao-vivo');
  revalidatePath('/', 'layout');
}

export async function saveLive(fd: FormData): Promise<ActionResult> {
  try {
    await requireAdminAction();
    const id = str(fd, 'id', 64);
    const startsLocal = str(fd, 'starts_at', 20);
    const tz = str(fd, 'tz_offset', 6);
    const starts = new Date(`${startsLocal}:00${/^[+-]\d{2}:\d{2}$/.test(tz) ? tz : '-03:00'}`);
    if (Number.isNaN(starts.getTime())) return { error: 'Data/hora inválida.' };
    const courseId = str(fd, 'course_id', 64);
    const title = str(fd, 'title', 160);
    if (!title) return { error: 'Informe o título.' };
    const values = [
      title,
      str(fd, 'description', 2000),
      extractYoutubeId(str(fd, 'youtube', 300)),
      str(fd, 'cover_url', 2000),
      isDocId(courseId) ? courseId : null,
      starts.toISOString(),
      bool(fd, 'show_replay'),
      bool(fd, 'chat_enabled'),
      bool(fd, 'is_published'),
    ];
    if (id) {
      if (!isDocId(id)) return { error: 'Inválido.' };
      await sql.exec(
        `update live_sessions set title = $2, description = $3, youtube_id = $4, cover_url = $5, course_id = $6, starts_at = $7,
           show_replay = $8, chat_enabled = $9, is_published = $10, updated_at = now() where id = $1`,
        [id, ...values],
      );
    } else {
      await sql.exec(
        `insert into live_sessions (id, title, description, youtube_id, cover_url, course_id, starts_at, show_replay, chat_enabled, is_published)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [newId(), ...values],
      );
    }
    refresh(id || undefined);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setLiveStatus(id: string, status: 'scheduled' | 'live' | 'ended'): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id) || !['scheduled', 'live', 'ended'].includes(status)) return { error: 'Inválido.' };
    const live = await sql.one<{ youtube_id: string }>(`select youtube_id from live_sessions where id = $1`, [id]);
    if (!live) return { error: 'Transmissão não encontrada.' };
    if (status === 'live' && !live.youtube_id) return { error: 'Cole o link da transmissão do YouTube antes de iniciar.' };
    await sql.exec(`update live_sessions set status = $2, updated_at = now() where id = $1`, [id, status]);
    // Os alunos na sala percebem a mudança na próxima consulta (alguns segundos)
    refresh(id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteLive(id: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    await sql.exec(`delete from live_sessions where id = $1`, [id]); // mensagens vão junto
    refresh(id);
    return { ok: true };
  } catch (e) {
    return fail(e, 'Não foi possível excluir.');
  }
}
