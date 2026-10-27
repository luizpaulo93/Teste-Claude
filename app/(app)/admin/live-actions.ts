'use server';

import { isDocId } from '@/lib/utils';

import { revalidatePath } from 'next/cache';
import { bool, fail, requireAdminAction, str, type ActionResult } from '@/lib/admin/guard';
import { db, nowIso } from '@/lib/db';
import { extractYoutubeId } from '@/lib/utils';

function refresh() {
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
    const row = {
      title: str(fd, 'title', 160),
      description: str(fd, 'description', 2000),
      youtube_id: extractYoutubeId(str(fd, 'youtube', 300)),
      cover_url: str(fd, 'cover_url', 2000),
      course_id: isDocId(courseId) ? courseId : null,
      starts_at: starts.toISOString(),
      show_replay: bool(fd, 'show_replay'),
      chat_enabled: bool(fd, 'chat_enabled'),
      is_published: bool(fd, 'is_published'),
      updated_at: nowIso(),
    };
    if (!row.title) return { error: 'Informe o título.' };
    if (id) {
      if (!isDocId(id)) return { error: 'Inválido.' };
      await db().doc(`live_sessions/${id}`).update(row);
    } else {
      const ref = await db().collection('live_sessions').add({ ...row, status: 'scheduled', created_at: nowIso() });
      await db().doc(`live_status/${ref.id}`).set({ status: 'scheduled' });
    }
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setLiveStatus(id: string, status: 'scheduled' | 'live' | 'ended'): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id) || !['scheduled', 'live', 'ended'].includes(status)) return { error: 'Inválido.' };
    const ref = db().doc(`live_sessions/${id}`);
    if (status === 'live' && !(await ref.get()).get('youtube_id')) return { error: 'Cole o link da transmissão do YouTube antes de iniciar.' };
    await ref.update({ status, updated_at: nowIso() });
    // Espelho público mínimo: os alunos são avisados em tempo real (sem expor o link do vídeo)
    await db().doc(`live_status/${id}`).set({ status });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteLive(id: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    await db().recursiveDelete(db().doc(`live_sessions/${id}`));
    await db().doc(`live_status/${id}`).delete();
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e, 'Não foi possível excluir.');
  }
}
