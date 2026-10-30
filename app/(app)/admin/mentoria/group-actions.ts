'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { fail, requireAdminAction, type ActionResult } from '@/lib/admin/guard';
import { newId, sql } from '@/lib/db';
import { ASSUNTO_BY_KEY, DISCIPLINES } from '@/lib/enem-matriz';
import { orderedKeys } from '@/lib/mentoria-data';
import { syncGroup } from '@/lib/mentoria-space';
import { isDocId } from '@/lib/utils';

const EMAIL_RE = /^[^\s@/]+@[^\s@/]+\.[^\s@/]{2,}$/;
const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

function refresh(id?: string) {
  updateTag('viewers'); // quem entra ou sai do grupo vê (ou deixa de ver) o menu Mentoria
  revalidatePath('/admin/mentoria', 'layout');
  if (id) revalidatePath(`/admin/mentoria/grupo/${id}`, 'layout');
  revalidatePath('/mentoria', 'layout');
}

export interface GroupInput {
  id?: string;
  name: string;
  description: string;
  student_emails: string[];
  class_ids: string[];
  exam_target: string;
  exam_date: string;
  start_date: string;
  end_date: string;
}

/** Cria/edita a mentoria em grupo: alunos um a um e/ou turmas inteiras. */
export async function saveGroup(data: GroupInput): Promise<ActionResult> {
  try {
    await requireAdminAction();
    const name = String(data.name ?? '').trim().slice(0, 120);
    if (!name) return { error: 'Dê um nome ao grupo.' };
    const emails = [...new Set((data.student_emails ?? []).map((e) => String(e).trim().toLowerCase()).filter((e) => EMAIL_RE.test(e)))].slice(0, 2000);
    const classes = [...new Set((data.class_ids ?? []).filter((c) => isDocId(String(c))))];
    if (!emails.length && !classes.length) return { error: 'Escolha alunos ou turmas.' };
    const id = data.id && isDocId(data.id) ? data.id : newId();
    const values = [
      id,
      name,
      String(data.description ?? '').slice(0, 1000),
      emails,
      classes,
      String(data.exam_target ?? '').slice(0, 120),
      date(data.exam_date),
      date(data.start_date) ?? new Date().toISOString().slice(0, 10),
      date(data.end_date),
    ];
    await sql.exec(
      `insert into mentoria_groups (id, name, description, student_emails, class_ids, exam_target, exam_date, start_date, end_date)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (id) do update set name = excluded.name, description = excluded.description, student_emails = excluded.student_emails,
         class_ids = excluded.class_ids, exam_target = excluded.exam_target, exam_date = excluded.exam_date, start_date = excluded.start_date,
         end_date = excluded.end_date, updated_at = now()`,
      values,
    );
    await syncGroup(id);
    refresh(id);
    return { ok: true, id };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteGroup(id: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    // Cronogramas criados pelo grupo saem junto; dúvidas e lives do grupo também
    await sql.exec(`delete from mentorias where group_id = $1`, [id]);
    await sql.exec(`delete from doubts where space = $1`, [`g:${id}`]);
    await sql.exec(`update live_sessions set space = null, is_published = false where space = $1`, [`g:${id}`]);
    await sql.exec(`delete from mentoria_groups where id = $1`, [id]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e, 'Não foi possível excluir.');
  }
}

/** Cronograma automático do grupo (vale para todos os alunos). */
export async function buildGroupPlan(id: string, disciplines: string[], order: 'prioridade' | 'matriz'): Promise<ActionResult & { count?: number }> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    const chosen = DISCIPLINES.map((d) => d.key).filter((k) => (disciplines ?? []).includes(k));
    if (!chosen.length) return { error: 'Escolha pelo menos uma disciplina.' };
    const mode = order === 'matriz' ? 'matriz' : 'prioridade';
    const keys = orderedKeys(chosen, mode);
    await sql.exec(`update mentoria_groups set plan_disciplines = $2, plan_order = $3, plan_keys = $4, updated_at = now() where id = $1`, [id, chosen, mode, keys]);
    await syncGroup(id);
    refresh(id);
    return { ok: true, count: keys.length };
  } catch (e) {
    return fail(e);
  }
}

/** Assuntos escolhidos à mão para o grupo (os novos entram no fim, mais cobrados primeiro). */
export async function setGroupAssuntos(id: string, keys: string[]): Promise<ActionResult & { added?: number; removed?: number }> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    const g = await sql.one<{ plan_keys: string[] }>(`select plan_keys from mentoria_groups where id = $1`, [id]);
    if (!g) return { error: 'Grupo não encontrado.' };
    const wanted = new Set((keys ?? []).filter((k) => ASSUNTO_BY_KEY.has(k)));
    const kept = g.plan_keys.filter((k) => wanted.has(k));
    const added = [...wanted].filter((k) => !g.plan_keys.includes(k)).sort((a, b) => ASSUNTO_BY_KEY.get(b)!.priority - ASSUNTO_BY_KEY.get(a)!.priority || ASSUNTO_BY_KEY.get(a)!.index - ASSUNTO_BY_KEY.get(b)!.index);
    const next = [...kept, ...added];
    const discs = [...new Set(next.map((k) => ASSUNTO_BY_KEY.get(k)!.discipline))];
    await sql.exec(`update mentoria_groups set plan_keys = $2, plan_disciplines = $3, updated_at = now() where id = $1`, [id, next, discs]);
    await syncGroup(id, undefined, { add: added, remove: g.plan_keys.filter((k) => !wanted.has(k)) });
    refresh(id);
    return { ok: true, added: added.length, removed: g.plan_keys.length - kept.length };
  } catch (e) {
    return fail(e);
  }
}
