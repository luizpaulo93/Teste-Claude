'use server';

import { updateTag } from 'next/cache';
import { authorOf } from '@/lib/author';
import { newId, sql } from '@/lib/db';
import { canSeeLive, liveFeed } from '@/lib/live';
import { getViewer } from '@/lib/session';
import type { LiveMessage, LiveSession } from '@/lib/types';
import { isDocId } from '@/lib/utils';

async function access(liveId: string) {
  const viewer = await getViewer();
  if (!viewer || !isDocId(liveId)) return null;
  const live = await sql.one<LiveSession>(`select * from live_sessions where id = $1`, [liveId]);
  if (!live || !(await canSeeLive(viewer, live))) return null;
  return { viewer, live };
}

export async function sendLiveMessage(liveId: string, text: string): Promise<{ error?: string; message?: LiveMessage }> {
  const a = await access(liveId);
  const body = text.trim().slice(0, 500);
  if (!a || !body) return { error: 'Não foi possível enviar.' };
  if (!a.live.chat_enabled || a.live.status === 'ended') return { error: 'O chat está fechado.' };
  const au = authorOf(a.viewer);
  const message = await sql.one<LiveMessage>(
    `insert into live_messages (id, live_id, author_id, author_name, author_avatar, author_role, text)
     values ($1, $2, $3, $4, $5, $6, $7) returning *`,
    [newId(), liveId, a.viewer.userId, au.author_name, au.author_avatar, au.author_role, body],
  );
  updateTag(`live-${liveId}`);
  return message ? { message } : { error: 'Não foi possível enviar.' };
}

export async function deleteLiveMessage(liveId: string, messageId: string) {
  const a = await access(liveId);
  if (!a || !isDocId(messageId)) return { error: 'Sem acesso.' };
  const row = await sql.one<{ author_id: string }>(`select author_id from live_messages where id = $1 and live_id = $2`, [messageId, liveId]);
  if (row && row.author_id !== a.viewer.userId && !a.viewer.isAdmin) return { error: 'Sem permissão.' };
  await sql.exec(`delete from live_messages where id = $1 and live_id = $2`, [messageId, liveId]);
  updateTag(`live-${liveId}`);
  return { ok: true };
}

/**
 * Chamado a cada poucos segundos pela sala ao vivo: devolve o status e as últimas mensagens.
 * O resultado fica em cache por 2 s, então mil alunos na mesma live não viram mil consultas.
 */
export async function pollLive(liveId: string) {
  const viewer = await getViewer();
  if (!viewer || !isDocId(liveId)) return { status: 'ended' as const, messages: [] as LiveMessage[] };
  const feed = await liveFeed(liveId);
  if (!feed.live || !(await canSeeLive(viewer, feed.live))) return { status: 'ended' as const, messages: [] as LiveMessage[] };
  return { status: feed.live.status, messages: feed.messages, files: feed.live.materials?.length ?? 0 };
}
