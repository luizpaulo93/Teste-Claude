'use server';

import { db, nowIso } from '@/lib/db';
import { getViewer } from '@/lib/session';
import type { Simulado, SimuladoSubmission } from '@/lib/types';
import { isDocId } from '@/lib/utils';

const GRACE_MS = 60_000; // tolerância de rede ao entregar no fim do tempo

async function context(simuladoId: string) {
  const viewer = await getViewer();
  if (!viewer || !viewer.isMember || !isDocId(simuladoId)) return { error: 'Sem acesso.' } as const;
  const simSnap = await db().doc(`simulados/${simuladoId}`).get();
  const sim = simSnap.data() as Simulado | undefined;
  if (!sim || (!sim.is_published && !viewer.isAdmin)) return { error: 'Simulado indisponível.' } as const;
  const ref = db().doc(`simulado_submissions/${simuladoId}_${viewer.userId}`);
  return { viewer, sim: { ...sim, id: simuladoId }, ref } as const;
}

function cleanAnswers(raw: string, n: number) {
  return [...String(raw ?? '').slice(0, n).padEnd(n, '-')].map((c) => ('ABCDE'.includes(c) ? c : '-')).join('');
}

export async function startSimulado(simuladoId: string) {
  const c = await context(simuladoId);
  if ('error' in c) return { error: c.error };
  if (c.sim.results_released) return { error: 'Este simulado já foi encerrado.' };
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(c.ref);
    if (snap.exists) return;
    tx.set(c.ref, {
      simulado_id: simuladoId,
      user_id: c.viewer.userId,
      answers: '-'.repeat(c.sim.question_count),
      status: 'in_progress',
      started_at: nowIso(),
      finished_at: null,
      duration_seconds: 0,
      updated_at: nowIso(),
    });
  });
  return { ok: true };
}

/** Salva as respostas durante a prova. Depois do tempo, entrega o que já estava salvo. */
export async function saveAnswers(simuladoId: string, answers: string) {
  const c = await context(simuladoId);
  if ('error' in c) return { error: c.error };
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(c.ref);
    const sub = snap.data() as SimuladoSubmission | undefined;
    if (!sub) return { error: 'Prova não iniciada.' };
    if (sub.status === 'completed') return { error: 'Prova já entregue.', completed: true };
    const started = new Date(sub.started_at).getTime();
    const limit = c.sim.time_limit_minutes * 60_000;
    if (limit && Date.now() > started + limit + GRACE_MS) {
      tx.update(c.ref, { status: 'completed', finished_at: nowIso(), duration_seconds: Math.round(limit / 1000), updated_at: nowIso() });
      return { error: 'O tempo acabou. Sua prova foi entregue com as respostas salvas.', completed: true };
    }
    tx.update(c.ref, { answers: cleanAnswers(answers, c.sim.question_count), updated_at: nowIso() });
    return { ok: true };
  });
}

export async function finishSimulado(simuladoId: string, answers: string) {
  const c = await context(simuladoId);
  if ('error' in c) return { error: c.error };
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(c.ref);
    const sub = snap.data() as SimuladoSubmission | undefined;
    if (!sub) return { error: 'Prova não iniciada.' };
    if (sub.status === 'completed') return { ok: true };
    const started = new Date(sub.started_at).getTime();
    const limit = c.sim.time_limit_minutes * 60_000;
    const late = limit > 0 && Date.now() > started + limit + GRACE_MS;
    const elapsed = Math.max(0, Math.round((Date.now() - started) / 1000));
    tx.update(c.ref, {
      ...(late ? {} : { answers: cleanAnswers(answers, c.sim.question_count) }),
      status: 'completed',
      finished_at: nowIso(),
      duration_seconds: limit ? Math.min(elapsed, Math.round(limit / 1000)) : elapsed,
      updated_at: nowIso(),
    });
    return { ok: true };
  });
}
