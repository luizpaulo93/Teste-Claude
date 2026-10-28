'use server';

import { sql, tx } from '@/lib/db';
import { getViewer } from '@/lib/session';
import type { Simulado, SimuladoSubmission } from '@/lib/types';
import { isDocId } from '@/lib/utils';

const GRACE_MS = 60_000; // tolerância de rede ao entregar no fim do tempo

async function context(simuladoId: string) {
  const viewer = await getViewer();
  if (!viewer || !viewer.isMember || !isDocId(simuladoId)) return { error: 'Sem acesso.' } as const;
  const sim = await sql.one<Simulado>(
    `select id, question_count, time_limit_minutes, is_published, results_released from simulados where id = $1`,
    [simuladoId],
  );
  if (!sim || (!sim.is_published && !viewer.isAdmin)) return { error: 'Simulado indisponível.' } as const;
  return { viewer, sim, subId: `${simuladoId}_${viewer.userId}` } as const;
}

function cleanAnswers(raw: string, n: number) {
  return [...String(raw ?? '').slice(0, n).padEnd(n, '-')].map((c) => ('ABCDE'.includes(c) ? c : '-')).join('');
}

export async function startSimulado(simuladoId: string) {
  const c = await context(simuladoId);
  if ('error' in c) return { error: c.error };
  if (c.sim.results_released) return { error: 'Este simulado já foi encerrado.' };
  await sql.exec(
    `insert into simulado_submissions (id, simulado_id, user_id, answers, status) values ($1, $2, $3, $4, 'in_progress')
     on conflict (id) do nothing`,
    [c.subId, simuladoId, c.viewer.userId, '-'.repeat(c.sim.question_count)],
  );
  return { ok: true };
}

/** Salva as respostas durante a prova. Depois do tempo, entrega o que já estava salvo. */
export async function saveAnswers(simuladoId: string, answers: string) {
  const c = await context(simuladoId);
  if ('error' in c) return { error: c.error };
  return tx(async (t) => {
    const sub = await t.one<SimuladoSubmission>(`select * from simulado_submissions where id = $1 for update`, [c.subId]);
    if (!sub) return { error: 'Prova não iniciada.' };
    if (sub.status === 'completed') return { error: 'Prova já entregue.', completed: true };
    const started = new Date(sub.started_at).getTime();
    const limit = c.sim.time_limit_minutes * 60_000;
    if (limit && Date.now() > started + limit + GRACE_MS) {
      await t.exec(
        `update simulado_submissions set status = 'completed', finished_at = now(), duration_seconds = $2, updated_at = now() where id = $1`,
        [c.subId, Math.round(limit / 1000)],
      );
      return { error: 'O tempo acabou. Sua prova foi entregue com as respostas salvas.', completed: true };
    }
    await t.exec(`update simulado_submissions set answers = $2, updated_at = now() where id = $1`, [c.subId, cleanAnswers(answers, c.sim.question_count)]);
    return { ok: true };
  });
}

export async function finishSimulado(simuladoId: string, answers: string) {
  const c = await context(simuladoId);
  if ('error' in c) return { error: c.error };
  return tx(async (t) => {
    const sub = await t.one<SimuladoSubmission>(`select * from simulado_submissions where id = $1 for update`, [c.subId]);
    if (!sub) return { error: 'Prova não iniciada.' };
    if (sub.status === 'completed') return { ok: true };
    const started = new Date(sub.started_at).getTime();
    const limit = c.sim.time_limit_minutes * 60_000;
    const late = limit > 0 && Date.now() > started + limit + GRACE_MS;
    const elapsed = Math.max(0, Math.round((Date.now() - started) / 1000));
    await t.exec(
      `update simulado_submissions set answers = $2, status = 'completed', finished_at = now(), duration_seconds = $3, updated_at = now() where id = $1`,
      [c.subId, late ? sub.answers : cleanAnswers(answers, c.sim.question_count), limit ? Math.min(elapsed, Math.round(limit / 1000)) : elapsed],
    );
    return { ok: true };
  });
}
