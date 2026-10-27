'use server';

import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import { authorOf } from '@/lib/author';
import { db, fromQuery, nowIso } from '@/lib/db';
import { getViewer } from '@/lib/session';
import type { DoubtReply } from '@/lib/types';
import { isDocId } from '@/lib/utils';

const PUBLIC = (process.env.R2_PUBLIC_URL ?? '').replace(/\/+$/, '');
const safeImage = (url: string) => (url && /^https?:\/\//.test(url) && (!PUBLIC || url.startsWith(PUBLIC)) ? url.slice(0, 1000) : '');

async function member() {
  const viewer = await getViewer();
  return viewer && viewer.isMember ? viewer : null;
}

export async function createDoubt(text: string, imageUrl = '') {
  const viewer = await member();
  const body = text.trim().slice(0, 4000);
  if (!viewer || !body) return { error: 'Não foi possível publicar.' };
  await db().collection('doubts').add({
    author_id: viewer.userId,
    ...authorOf(viewer),
    text: body,
    image_url: safeImage(imageUrl),
    is_resolved: false,
    likes_count: 0,
    replies_count: 0,
    created_at: nowIso(),
  });
  revalidatePath('/duvidas');
  return { ok: true };
}

export async function addReply(doubtId: string, text: string, imageUrl = '') {
  const viewer = await member();
  const body = text.trim().slice(0, 4000);
  if (!viewer || !body || !isDocId(doubtId)) return { error: 'Não foi possível responder.' };
  const doubtRef = db().doc(`doubts/${doubtId}`);
  const replyRef = doubtRef.collection('replies').doc();
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(doubtRef);
    if (!snap.exists) throw new Error('não existe');
    tx.set(replyRef, { doubt_id: doubtId, author_id: viewer.userId, ...authorOf(viewer), text: body, image_url: safeImage(imageUrl), created_at: nowIso() });
    tx.update(doubtRef, { replies_count: FieldValue.increment(1) });
  });
  return { ok: true };
}

export async function listReplies(doubtId: string): Promise<DoubtReply[]> {
  const viewer = await member();
  if (!viewer || !isDocId(doubtId)) return [];
  const snap = await db().collection(`doubts/${doubtId}/replies`).orderBy('created_at').limit(200).get();
  return fromQuery<DoubtReply>(snap);
}

export async function toggleLike(doubtId: string, value: boolean) {
  const viewer = await member();
  if (!viewer || !isDocId(doubtId)) return { error: 'Sem acesso.' };
  const doubtRef = db().doc(`doubts/${doubtId}`);
  const likeRef = doubtRef.collection('likes').doc(viewer.userId);
  await db().runTransaction(async (tx) => {
    const [like, doubt] = await Promise.all([tx.get(likeRef), tx.get(doubtRef)]);
    if (!doubt.exists || like.exists === value) return;
    if (value) tx.set(likeRef, { created_at: nowIso() });
    else tx.delete(likeRef);
    tx.update(doubtRef, { likes_count: FieldValue.increment(value ? 1 : -1) });
  });
  return { ok: true };
}

export async function setResolved(doubtId: string, value: boolean) {
  const viewer = await member();
  if (!viewer || !isDocId(doubtId)) return { error: 'Sem acesso.' };
  const ref = db().doc(`doubts/${doubtId}`);
  const snap = await ref.get();
  if (!snap.exists) return { error: 'Dúvida não encontrada.' };
  if (snap.data()?.author_id !== viewer.userId && !viewer.isAdmin) return { error: 'Sem permissão.' };
  await ref.update({ is_resolved: value });
  return { ok: true };
}

export async function deleteDoubt(doubtId: string) {
  const viewer = await member();
  if (!viewer || !isDocId(doubtId)) return { error: 'Sem acesso.' };
  const ref = db().doc(`doubts/${doubtId}`);
  const snap = await ref.get();
  if (!snap.exists) return { ok: true };
  if (snap.data()?.author_id !== viewer.userId && !viewer.isAdmin) return { error: 'Sem permissão.' };
  await db().recursiveDelete(ref);
  revalidatePath('/duvidas');
  return { ok: true };
}

export async function deleteReply(doubtId: string, replyId: string) {
  const viewer = await member();
  if (!viewer || !isDocId(doubtId) || !isDocId(replyId)) return { error: 'Sem acesso.' };
  const doubtRef = db().doc(`doubts/${doubtId}`);
  const ref = doubtRef.collection('replies').doc(replyId);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: true };
    if (snap.data()?.author_id !== viewer.userId && !viewer.isAdmin) return { error: 'Sem permissão.' };
    tx.delete(ref);
    tx.update(doubtRef, { replies_count: FieldValue.increment(-1) });
    return { ok: true };
  });
}
