'use server';

import { revalidatePath } from 'next/cache';
import { emailKey, sql } from '@/lib/db';
import { getViewer } from '@/lib/session';
import { isDocId } from '@/lib/utils';

async function myMentoriaId() {
  const viewer = await getViewer();
  if (!viewer) return null;
  const row = await sql.one<{ id: string }>(`select id from mentorias where id = $1`, [emailKey(viewer.email)]);
  return row?.id ?? null;
}

export async function toggleTask(taskId: string, done: boolean) {
  const mid = await myMentoriaId();
  if (!mid || !isDocId(taskId)) return { error: 'Sem acesso.' };
  const n = await sql.exec(
    `update mentoria_tasks set done = $3, done_at = case when $3 then now() else null end where id = $1 and mentoria_id = $2`,
    [taskId, mid, done],
  );
  return n ? { ok: true } : { error: 'Sem acesso.' };
}

export async function saveCheckin(week: string, data: { hours_studied: number; questions_done: number; focus_rating: number; wins: string; difficulties: string }) {
  const mid = await myMentoriaId();
  if (!mid || !/^\d{4}-\d{2}-\d{2}$/.test(week)) return { error: 'Sem acesso.' };
  // O feedback do mentor nunca é alterado pelo aluno
  await sql.exec(
    `insert into mentoria_checkins (id, mentoria_id, week_start, hours_studied, questions_done, focus_rating, wins, difficulties)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (id) do update set hours_studied = excluded.hours_studied, questions_done = excluded.questions_done,
       focus_rating = excluded.focus_rating, wins = excluded.wins, difficulties = excluded.difficulties, updated_at = now()`,
    [
      `${mid}_${week}`,
      mid,
      week,
      Math.min(168, Math.max(0, Number(data.hours_studied) || 0)),
      Math.min(5000, Math.max(0, Math.round(Number(data.questions_done) || 0))),
      Math.min(5, Math.max(1, Math.round(Number(data.focus_rating) || 3))),
      String(data.wins ?? '').slice(0, 1500),
      String(data.difficulties ?? '').slice(0, 1500),
    ],
  );
  revalidatePath('/mentoria');
  return { ok: true };
}
