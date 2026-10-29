import 'server-only';
import { sql, tx } from './db';
import { evaluateCohort } from './tri';
import type { EnemArea, SimuladoSubmission } from './types';

/**
 * Calcula a TRI e a coerência de TODOS que entregaram e grava os resultados.
 * Igual ao MemberClass: a dificuldade de cada questão e a coerência dependem da turma inteira,
 * então cada nova entrega depois da liberação recalibra as notas de todos.
 */
export async function computeResults(simuladoId: string): Promise<{ error?: string }> {
  return tx(async (t) => {
    // Uma recalibração por vez para cada simulado (entregas simultâneas não se atropelam)
    await t.exec(`select pg_advisory_xact_lock(hashtext($1))`, ['tri:' + simuladoId]);
    const sim = await t.one<{ area: EnemArea; question_count: number }>(`select area, question_count from simulados where id = $1`, [simuladoId]);
    if (!sim) return { error: 'Simulado não encontrado.' };
    const key = (await t.one<{ answer_key: string }>(`select answer_key from simulado_keys where simulado_id = $1`, [simuladoId]))?.answer_key ?? '';
    if (key.length !== sim.question_count) return { error: 'Cadastre o gabarito completo antes de liberar.' };
    const subs = await t.query<SimuladoSubmission>(`select user_id, answers from simulado_submissions where simulado_id = $1 and status = 'completed'`, [simuladoId]);

    const { rows, stats } = evaluateCohort(sim.area, sim.question_count, key, subs);
    await t.exec(`delete from simulado_results where simulado_id = $1`, [simuladoId]);
    for (let i = 0; i < rows.length; i += 500) {
      await t.exec(
        `insert into simulado_results (simulado_id, user_id, correct, wrong, blank, accuracy, coherence, tri_score, tri_min, tri_mean, tri_max, tiers, breakdown)
         select $1, r.user_id, r.correct, r.wrong, r.blank, r.accuracy, r.coherence, r.tri_score, r.tri_min, r.tri_mean, r.tri_max, r.tiers, r.breakdown
           from jsonb_to_recordset($2::jsonb) as r(user_id text, correct int, wrong int, blank int, accuracy float8, coherence float8,
             tri_score float8, tri_min float8, tri_mean float8, tri_max float8, tiers jsonb, breakdown jsonb)`,
        [simuladoId, JSON.stringify(rows.slice(i, i + 500))],
      );
    }
    await t.exec(`update simulados set results_released = true, stats = $2 where id = $1`, [simuladoId, JSON.stringify(stats)]);
    return {};
  });
}

/** Depois de uma entrega: se as notas já foram liberadas, recalibra a turma na hora. */
export async function recalibrateIfReleased(simuladoId: string) {
  const row = await sql.one<{ results_released: boolean }>(`select results_released from simulados where id = $1`, [simuladoId]);
  if (row?.results_released) await computeResults(simuladoId);
}
