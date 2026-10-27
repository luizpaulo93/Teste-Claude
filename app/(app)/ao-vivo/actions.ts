'use server';

import { authorOf } from '@/lib/author';
import { db, fromDoc, fromQuery, nowIso } from '@/lib/db';
import { canSeeLive } from '@/lib/live';
import { getViewer } from '@/lib/session';
import type { LiveMessage, LiveSession } from '@/lib/types';
import { isDocId } from '@/lib/utils';

async function access(liveId: string) {
  const viewer = await getViewer();
  if (!viewer || !isDocId(liveId)) return null;
  const live = fromDoc<LiveSession>(await db().doc(`live_sessions/${liveId}`).get());
  if (!live || !(await canSeeLive(viewer, live))) return null;
  return { viewer, live };
}

export async function sendLiveMessage(liveId: string, text: string): Promise<{ error?: string; message?: LiveMessage }> {
  const a = await access(liveId);
  const body = text.trim().slice(0, 500);
  if (!a || !body) return { error: 'Não foi possível enviar.' };
  if (!a.live.chat_enabled || a.live.status === 'ended') return { error: 'O chat está fechado.' };
  const ref = db().collection(`live_sessions/${liveId}/messages`).doc();
  const message = { live_id: liveId, author_id: a.viewer.userId, ...authorOf(a.viewer), text: body, created_at: nowIso() };
  await ref.set(message);
  return { message: { id: ref.id, ...message } };
}

export async function deleteLiveMessage(liveId: string, messageId: string) {
  const a = await access(liveId);
  if (!a || !isDocId(messageId)) return { error: 'Sem acesso.' };
  const ref = db().doc(`live_sessions/${liveId}/messages/${messageId}`);
  const snap = await ref.get();
  if (snap.exists && snap.data()?.author_id !== a.viewer.userId && !a.viewer.isAdmin) return { error: 'Sem permissão.' };
  await ref.delete();
  return { ok: true };
}

/** Plano B (sem login do Firebase no navegador): busca mensagens novas e o status pelo servidor. */
export async function pollLive(liveId: string, after: string) {
  const a = await access(liveId);
  if (!a) return { status: 'ended' as const, messages: [] as LiveMessage[] };
  let q = db().collection(`live_sessions/${liveId}/messages`).orderBy('created_at').limit(100);
  if (after) q = q.where('created_at', '>', after);
  return { status: a.live.status, messages: fromQuery<LiveMessage>(await q.get()) };
}
