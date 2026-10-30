'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { fail, requireAdminAction, type ActionResult } from '@/lib/admin/guard';
import { sql } from '@/lib/db';
import { DISCIPLINES } from '@/lib/enem-matriz';
import { blocksOf } from '@/lib/mentoria-blocks';
import { archiveCycle } from '@/lib/mentoria-cycles';
import { orderedKeys, reschedule, writePlan } from '@/lib/mentoria-data';
import { syncGroup } from '@/lib/mentoria-space';
import { isDocId } from '@/lib/utils';

const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export interface CycleInput {
  title: string;
  exam_date: string;
  start_date: string;
  end_date: string;
  scope: 'completa' | 'especifica';
}

function clean(d: CycleInput) {
  return {
    title: String(d.title ?? '').trim().slice(0, 120),
    exam_date: date(d.exam_date),
    start_date: date(d.start_date) ?? new Date().toISOString().slice(0, 10),
    end_date: date(d.end_date),
    scope: d.scope === 'especifica' ? ('especifica' as const) : ('completa' as const),
  };
}

function refresh() {
  updateTag('viewers');
  revalidatePath('/admin/mentoria', 'layout');
  revalidatePath('/mentoria', 'layout');
}

/** Salva o ciclo atual do aluno (fica em "Anteriores") e começa um novo, que vira a página inicial. */
export async function newCycle(mentoriaId: string, data: CycleInput): Promise<ActionResult> {
  try {
    await requireAdminAction();
    const c = clean(data);
    if (!c.title) return { error: 'Dê um nome ao novo ciclo (ex.: 2ª avaliação).' };
    if (c.end_date && c.end_date < c.start_date) return { error: 'O fim é antes do início.' };
    const m = await sql.one<{ group_id: string | null }>(`select group_id from mentorias where id = $1`, [mentoriaId]);
    if (!m) return { error: 'Mentoria não encontrada.' };
    if (m.group_id) return { error: 'Este aluno está numa mentoria em grupo: comece o novo ciclo na página do grupo.' };
    await archiveCycle(mentoriaId);
    await sql.exec(
      `update mentorias set exam_target = $2, exam_date = $3, start_date = $4, end_date = $5, scope = $6, status = 'active', updated_at = now() where id = $1`,
      [mentoriaId, c.title, c.exam_date, c.start_date, c.end_date, c.scope],
    );
    if (c.scope === 'completa') await writePlan(mentoriaId, DISCIPLINES.map((d) => d.key), 'prioridade');
    else await sql.exec(`update mentorias set plan_disciplines = '{}' where id = $1`, [mentoriaId]);
    await reschedule(mentoriaId);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Novo ciclo do grupo: cada aluno guarda o ciclo atual (com as apostilas do grupo) e todos recomeçam. */
export async function newGroupCycle(groupId: string, data: CycleInput): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(groupId)) return { error: 'Inválido.' };
    const c = clean(data);
    if (!c.title) return { error: 'Dê um nome ao novo ciclo (ex.: 2ª avaliação).' };
    if (c.end_date && c.end_date < c.start_date) return { error: 'O fim é antes do início.' };
    const groupBlocks = await blocksOf([`g:${groupId}`]);
    const members = await sql.query<{ id: string }>(`select id from mentorias where group_id = $1`, [groupId]);
    for (const m of members) await archiveCycle(m.id, groupBlocks);
    await sql.exec(`delete from mentoria_blocks where space = $1`, [`g:${groupId}`]);
    const all = DISCIPLINES.map((d) => d.key);
    await sql.exec(
      `update mentoria_groups set exam_target = $2, exam_date = $3, start_date = $4, end_date = $5, scope = $6,
         plan_keys = $7, plan_disciplines = $8, plan_order = 'prioridade', updated_at = now() where id = $1`,
      [groupId, c.title, c.exam_date, c.start_date, c.end_date, c.scope, c.scope === 'completa' ? orderedKeys(all, 'prioridade') : [], c.scope === 'completa' ? all : []],
    );
    await syncGroup(groupId);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
