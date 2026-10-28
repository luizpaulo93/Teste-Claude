'use server';

import { revalidatePath } from 'next/cache';
import { authorOf } from '@/lib/author';
import { newId, sql, tx } from '@/lib/db';
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
  const a = authorOf(viewer);
  await sql.exec(
    `insert into doubts (id, author_id, author_name, author_avatar, author_role, text, image_url) values ($1, $2, $3, $4, $5, $6, $7)`,
    [newId(), viewer.userId, a.author_name, a.author_avatar, a.author_role, body, safeImage(imageUrl)],
  );
  revalidatePath('/duvidas');
  return { ok: true };
}

export async function addReply(doubtId: string, text: string, imageUrl = '') {
  const viewer = await member();
  const body = text.trim().slice(0, 4000);
  if (!viewer || !body || !isDocId(doubtId)) return { error: 'Não foi possível responder.' };
  const a = authorOf(viewer);
  const ok = await tx(async (t) => {
    const n = await t.exec(`update doubts set replies_count = replies_count + 1 where id = $1`, [doubtId]);
    if (!n) return false;
    await t.exec(
      `insert into doubt_replies (id, doubt_id, author_id, author_name, author_avatar, author_role, text, image_url) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [newId(), doubtId, viewer.userId, a.author_name, a.author_avatar, a.author_role, body, safeImage(imageUrl)],
    );
    return true;
  });
  return ok ? { ok: true } : { error: 'Esta dúvida foi apagada.' };
}

export async function listReplies(doubtId: string): Promise<DoubtReply[]> {
  const viewer = await member();
  if (!viewer || !isDocId(doubtId)) return [];
  return sql.query<DoubtReply>(`select * from doubt_replies where doubt_id = $1 order by created_at limit 200`, [doubtId]);
}

export async function toggleLike(doubtId: string, value: boolean) {
  const viewer = await member();
  if (!viewer || !isDocId(doubtId)) return { error: 'Sem acesso.' };
  await tx(async (t) => {
    const changed = value
      ? await t.exec(`insert into doubt_likes (doubt_id, user_id) select $1, $2 where exists (select 1 from doubts where id = $1) on conflict do nothing`, [doubtId, viewer.userId])
      : await t.exec(`delete from doubt_likes where doubt_id = $1 and user_id = $2`, [doubtId, viewer.userId]);
    if (changed) await t.exec(`update doubts set likes_count = greatest(0, likes_count + $2) where id = $1`, [doubtId, value ? 1 : -1]);
  });
  return { ok: true };
}

async function ownDoubt(doubtId: string, viewer: { userId: string; isAdmin: boolean }) {
  const row = await sql.one<{ author_id: string }>(`select author_id from doubts where id = $1`, [doubtId]);
  if (!row) return 'missing' as const;
  return row.author_id === viewer.userId || viewer.isAdmin ? ('ok' as const) : ('denied' as const);
}

export async function setResolved(doubtId: string, value: boolean) {
  const viewer = await member();
  if (!viewer || !isDocId(doubtId)) return { error: 'Sem acesso.' };
  const own = await ownDoubt(doubtId, viewer);
  if (own === 'missing') return { error: 'Dúvida não encontrada.' };
  if (own === 'denied') return { error: 'Sem permissão.' };
  await sql.exec(`update doubts set is_resolved = $2 where id = $1`, [doubtId, value]);
  return { ok: true };
}

export async function deleteDoubt(doubtId: string) {
  const viewer = await member();
  if (!viewer || !isDocId(doubtId)) return { error: 'Sem acesso.' };
  const own = await ownDoubt(doubtId, viewer);
  if (own === 'missing') return { ok: true };
  if (own === 'denied') return { error: 'Sem permissão.' };
  await sql.exec(`delete from doubts where id = $1`, [doubtId]); // respostas e curtidas vão junto
  revalidatePath('/duvidas');
  return { ok: true };
}

export async function deleteReply(doubtId: string, replyId: string) {
  const viewer = await member();
  if (!viewer || !isDocId(doubtId) || !isDocId(replyId)) return { error: 'Sem acesso.' };
  return tx(async (t) => {
    const row = await t.one<{ author_id: string }>(`select author_id from doubt_replies where id = $1 and doubt_id = $2 for update`, [replyId, doubtId]);
    if (!row) return { ok: true };
    if (row.author_id !== viewer.userId && !viewer.isAdmin) return { error: 'Sem permissão.' };
    await t.exec(`delete from doubt_replies where id = $1`, [replyId]);
    await t.exec(`update doubts set replies_count = greatest(0, replies_count - 1) where id = $1`, [doubtId]);
    return { ok: true };
  });
}
