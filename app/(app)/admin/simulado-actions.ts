'use server';

import { revalidatePath } from 'next/cache';
import { bool, fail, int, requireAdminAction, str, type ActionResult } from '@/lib/admin/guard';
import { newId, sql, tx } from '@/lib/db';
import { removeObjects } from '@/lib/storage/server';
import { computeResults, recalibrateIfReleased } from '@/lib/simulado-results';
import type { EnemArea } from '@/lib/types';
import { isDocId } from '@/lib/utils';

function refresh(id?: string) {
  revalidatePath('/admin/simulados');
  if (id) revalidatePath(`/admin/simulados/${id}`);
  revalidatePath('/simulados', 'layout');
}

export async function saveSimulado(fd: FormData): Promise<ActionResult> {
  try {
    await requireAdminAction();
    const id = str(fd, 'id', 64);
    const area = str(fd, 'area', 2) as EnemArea;
    if (!['MT', 'CN', 'CH', 'LC'].includes(area)) return { error: 'Área inválida.' };
    const question_count = int(fd, 'question_count', 1, 180, 45);
    const title = str(fd, 'title', 160);
    if (!title) return { error: 'Informe o título.' };
    const key = str(fd, 'answer_key', 400).toUpperCase().replace(/[^A-E]/g, '');
    if (key && key.length !== question_count) return { error: `O gabarito tem ${key.length} letras, mas a prova tem ${question_count} questões.` };
    if (id && !isDocId(id)) return { error: 'Inválido.' };
    const simId = id || newId();
    const values = [simId, title, area, question_count, int(fd, 'time_limit_minutes', 0, 600, 0), str(fd, 'pdf_path', 500), bool(fd, 'is_published')];

    await tx(async (t) => {
      if (id) {
        await t.exec(
          `update simulados set title = $2, area = $3, question_count = $4, time_limit_minutes = $5, pdf_path = $6, is_published = $7, updated_at = now() where id = $1`,
          values,
        );
      } else {
        await t.exec(
          `insert into simulados (id, title, area, question_count, time_limit_minutes, pdf_path, is_published) values ($1, $2, $3, $4, $5, $6, $7)`,
          values,
        );
      }
      // Gabarito em tabela separada: nunca vai para a tela do aluno antes da liberação
      await t.exec(
        `insert into simulado_keys (simulado_id, answer_key) values ($1, $2) on conflict (simulado_id) do update set answer_key = excluded.answer_key`,
        [simId, key],
      );
    });
    refresh(simId);
    return { ok: true, id: simId };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteSimulado(id: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    // Gabarito, entregas e resultados são apagados junto (on delete cascade)
    const row = await sql.one<{ pdf_path: string }>(`delete from simulados where id = $1 returning pdf_path`, [id]);
    if (row?.pdf_path) await removeObjects('materials', [row.pdf_path]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e, 'Não foi possível excluir.');
  }
}

export async function setSimuladoPublished(id: string, value: boolean): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    await sql.exec(`update simulados set is_published = $2 where id = $1`, [id, value]);
    refresh(id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Calcula as notas TRI de todos que entregaram e libera os resultados.
 * Roda uma vez (ou ao clicar em "Recalcular"); os alunos só leem o resultado pronto.
 */
export async function releaseResults(id: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    const r = await computeResults(id);
    if (r.error) return { error: r.error };
    refresh(id);
    return { ok: true };
  } catch (e) {
    return fail(e, 'Falha ao calcular resultados.');
  }
}

export async function hideResults(id: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    await sql.exec(`update simulados set results_released = false where id = $1`, [id]);
    refresh(id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Permite que o aluno refaça a prova (apaga a entrega e o resultado dele). */
export async function resetSubmission(simuladoId: string, userId: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(simuladoId) || !isDocId(userId)) return { error: 'Inválido.' };
    await tx(async (t) => {
      await t.exec(`delete from simulado_results where simulado_id = $1 and user_id = $2`, [simuladoId, userId]);
      await t.exec(`delete from simulado_submissions where simulado_id = $1 and user_id = $2`, [simuladoId, userId]);
    });
    await recalibrateIfReleased(simuladoId);
    refresh(simuladoId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
