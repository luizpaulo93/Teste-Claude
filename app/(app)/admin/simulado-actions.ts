'use server';

import { revalidatePath } from 'next/cache';
import { bool, fail, int, requireAdminAction, str, type ActionResult } from '@/lib/admin/guard';
import { db, fromQuery, nowIso } from '@/lib/db';
import { removeObjects } from '@/lib/storage/server';
import { evaluateCohort } from '@/lib/tri';
import type { EnemArea, SimuladoSubmission } from '@/lib/types';
import { isDocId } from '@/lib/utils';

function refresh(id?: string) {
  revalidatePath('/admin/simulados');
  if (id) revalidatePath(`/admin/simulados/${id}`);
  revalidatePath('/simulados', 'layout');
}

async function deleteWhere(collection: string, field: string, value: string) {
  const d = db();
  const snap = await d.collection(collection).where(field, '==', value).select().get();
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = d.batch();
    snap.docs.slice(i, i + 400).forEach((x) => batch.delete(x.ref));
    await batch.commit();
  }
}

export async function saveSimulado(fd: FormData): Promise<ActionResult> {
  try {
    await requireAdminAction();
    const id = str(fd, 'id', 64);
    const area = str(fd, 'area', 2) as EnemArea;
    if (!['MT', 'CN', 'CH', 'LC'].includes(area)) return { error: 'Área inválida.' };
    const question_count = int(fd, 'question_count', 1, 180, 45);
    const row = {
      title: str(fd, 'title', 160),
      area,
      question_count,
      time_limit_minutes: int(fd, 'time_limit_minutes', 0, 600, 0),
      pdf_path: str(fd, 'pdf_path', 500),
      is_published: bool(fd, 'is_published'),
      updated_at: nowIso(),
    };
    if (!row.title) return { error: 'Informe o título.' };
    const key = str(fd, 'answer_key', 400).toUpperCase().replace(/[^A-E]/g, '');
    if (key && key.length !== question_count) return { error: `O gabarito tem ${key.length} letras, mas a prova tem ${question_count} questões.` };

    let simId = id;
    if (id) {
      if (!isDocId(id)) return { error: 'Inválido.' };
      await db().doc(`simulados/${id}`).update(row);
    } else {
      simId = (await db().collection('simulados').add({ ...row, results_released: false, stats: {}, created_at: nowIso() })).id;
    }
    // Gabarito em coleção separada: nunca vai para a tela do aluno antes da liberação
    await db().doc(`simulado_keys/${simId}`).set({ answer_key: key });
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
    const ref = db().doc(`simulados/${id}`);
    const pdf = String((await ref.get()).get('pdf_path') ?? '');
    await Promise.all([deleteWhere('simulado_submissions', 'simulado_id', id), deleteWhere('simulado_results', 'simulado_id', id)]);
    await Promise.all([ref.delete(), db().doc(`simulado_keys/${id}`).delete()]);
    await removeObjects('materials', [pdf]);
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
    await db().doc(`simulados/${id}`).update({ is_published: value });
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
    const d = db();
    const [simSnap, keySnap, subsSnap] = await Promise.all([
      d.doc(`simulados/${id}`).get(),
      d.doc(`simulado_keys/${id}`).get(),
      d.collection('simulado_submissions').where('simulado_id', '==', id).get(),
    ]);
    const sim = simSnap.data() as { area: EnemArea; question_count: number } | undefined;
    const answerKey = String(keySnap.get('answer_key') ?? '');
    if (!sim) return { error: 'Simulado não encontrado.' };
    if (answerKey.length !== sim.question_count) return { error: 'Cadastre o gabarito completo antes de liberar.' };

    const subs = fromQuery<SimuladoSubmission>(subsSnap).filter((s) => s.status === 'completed');
    const { rows, stats } = evaluateCohort(sim.area, sim.question_count, answerKey, subs);
    await deleteWhere('simulado_results', 'simulado_id', id);
    const now = nowIso();
    for (let i = 0; i < rows.length; i += 400) {
      const batch = d.batch();
      rows.slice(i, i + 400).forEach((r) => batch.set(d.doc(`simulado_results/${id}_${r.user_id}`), { ...r, simulado_id: id, computed_at: now }));
      await batch.commit();
    }
    await d.doc(`simulados/${id}`).update({ results_released: true, stats });
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
    await db().doc(`simulados/${id}`).update({ results_released: false });
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
    await Promise.all([
      db().doc(`simulado_results/${simuladoId}_${userId}`).delete(),
      db().doc(`simulado_submissions/${simuladoId}_${userId}`).delete(),
    ]);
    refresh(simuladoId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
