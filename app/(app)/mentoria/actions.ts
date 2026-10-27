'use server';

import { revalidatePath } from 'next/cache';
import { db, emailKey, nowIso } from '@/lib/db';
import { getViewer } from '@/lib/session';
import { isDocId } from '@/lib/utils';

async function myMentoriaId() {
  const viewer = await getViewer();
  if (!viewer) return null;
  const id = emailKey(viewer.email);
  const snap = await db().doc(`mentorias/${id}`).get();
  return snap.exists ? id : null;
}

export async function toggleTask(taskId: string, done: boolean) {
  const mid = await myMentoriaId();
  if (!mid || !isDocId(taskId)) return { error: 'Sem acesso.' };
  const ref = db().doc(`mentoria_tasks/${taskId}`);
  const snap = await ref.get();
  if (snap.data()?.mentoria_id !== mid) return { error: 'Sem acesso.' };
  await ref.update({ done, done_at: done ? nowIso() : null });
  return { ok: true };
}

export async function saveCheckin(week: string, data: { hours_studied: number; questions_done: number; focus_rating: number; wins: string; difficulties: string }) {
  const mid = await myMentoriaId();
  if (!mid || !/^\d{4}-\d{2}-\d{2}$/.test(week)) return { error: 'Sem acesso.' };
  const ref = db().doc(`mentoria_checkins/${mid}_${week}`);
  const snap = await ref.get();
  const clean = {
    mentoria_id: mid,
    week_start: week,
    hours_studied: Math.min(168, Math.max(0, Number(data.hours_studied) || 0)),
    questions_done: Math.min(5000, Math.max(0, Math.round(Number(data.questions_done) || 0))),
    focus_rating: Math.min(5, Math.max(1, Math.round(Number(data.focus_rating) || 3))),
    wins: String(data.wins ?? '').slice(0, 1500),
    difficulties: String(data.difficulties ?? '').slice(0, 1500),
    updated_at: nowIso(),
  };
  // O feedback do mentor nunca é alterado pelo aluno
  if (snap.exists) await ref.update(clean);
  else await ref.set({ ...clean, mentor_feedback: '', feedback_at: null });
  revalidatePath('/mentoria');
  return { ok: true };
}
