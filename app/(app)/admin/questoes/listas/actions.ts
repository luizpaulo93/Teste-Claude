'use server';

import { revalidatePath } from 'next/cache';
import { newId, sql } from '@/lib/db';
import { listHtml } from '@/lib/list-html';
import { htmlToPdf } from '@/lib/pdf-render';
import { getList, getTemplate, questionsOf, type QList } from '@/lib/question-lists';
import { getViewer } from '@/lib/session';
import { putObject, removeObjects } from '@/lib/storage/server';

async function admin() {
  const v = await getViewer();
  if (!v?.isAdmin) throw new Error('Acesso negado.');
  return v;
}
const okId = (s: unknown) => typeof s === 'string' && /^[\w-]{1,160}$/.test(s);
const okUrl = (u: unknown) => (typeof u === 'string' && /^https?:\/\/[^\s"'<>]+$/.test(u) ? u : '');
const posInt = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : null);

function refresh(id?: string) {
  revalidatePath('/admin/questoes', 'layout');
  revalidatePath('/questoes', 'layout');
  if (id) revalidatePath(`/listas/${id}`);
}

/** Salva a lista (nova ou editada). Simulados feitos com ela e ainda sem respostas são atualizados juntos. */
export async function saveList(input: { id?: string; title: string; question_ids: string[]; template_id: string | null; mode?: string }) {
  const v = await admin();
  const title = String(input.title ?? '')
    .trim()
    .slice(0, 160);
  if (!title) return { error: 'Dê um nome para a lista.' };
  const ids = [...new Set((Array.isArray(input.question_ids) ? input.question_ids : []).filter(okId))].slice(0, 300);
  if (!ids.length) return { error: 'Escolha pelo menos uma questão.' };
  const tpl = input.template_id && okId(input.template_id) ? input.template_id : null;
  const mode = input.mode === 'teste' ? 'teste' : 'lista';
  const id = input.id && okId(input.id) ? input.id : newId();
  await sql.exec(
    `insert into question_lists (id, title, question_ids, template_id, mode, created_by) values ($1, $2, $3, $4, $5, $6)
     on conflict (id) do update set title = excluded.title, question_ids = excluded.question_ids, template_id = excluded.template_id,
       mode = excluded.mode, updated_at = now()`,
    [id, title, ids, tpl, mode, v.userId],
  );
  const sims = await syncSimulados(id).catch(() => ({ updated: 0, locked: 0 }));
  refresh(id);
  return { id, ...sims };
}

export async function deleteList(id: string) {
  await admin();
  await sql.exec(`delete from question_lists where id = $1`, [id]);
  refresh();
  return {};
}

// ---------------------------------------------------------------- cabeçalhos e rodapés
export async function saveTemplate(t: {
  id?: string;
  name: string;
  header_url: string;
  header_w?: number | null;
  header_h?: number | null;
  footer_url: string;
  footer_w?: number | null;
  footer_h?: number | null;
}) {
  await admin();
  const name = String(t.name ?? '')
    .trim()
    .slice(0, 80);
  if (!name) return { error: 'Dê um nome ao modelo.' };
  const header = okUrl(t.header_url);
  const footer = okUrl(t.footer_url);
  if (!header && !footer) return { error: 'Coloque a imagem do cabeçalho ou do rodapé.' };
  const id = t.id && okId(t.id) ? t.id : newId();
  await sql.exec(
    `insert into list_templates (id, name, header_url, header_w, header_h, footer_url, footer_w, footer_h) values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (id) do update set name = excluded.name, header_url = excluded.header_url, header_w = excluded.header_w, header_h = excluded.header_h,
       footer_url = excluded.footer_url, footer_w = excluded.footer_w, footer_h = excluded.footer_h, updated_at = now()`,
    [id, name, header, posInt(t.header_w), posInt(t.header_h), footer, posInt(t.footer_w), posInt(t.footer_h)],
  );
  refresh();
  return { id };
}

export async function deleteTemplate(id: string) {
  await admin();
  await sql.exec(`delete from list_templates where id = $1`, [id]);
  refresh();
  return {};
}

// ---------------------------------------------------------------- aplicar: turmas, mentorias, alunos, aulas
export async function saveListAudience(id: string, audience: string[], mode: string) {
  await admin();
  const list = (Array.isArray(audience) ? audience : []).filter((a) => typeof a === 'string' && /^(c|m|g|u):.{1,200}$/.test(a)).slice(0, 500);
  await sql.exec(`update question_lists set audience = $2, mode = $3, updated_at = now() where id = $1`, [
    id,
    [...new Set(list)],
    mode === 'teste' ? 'teste' : 'lista',
  ]);
  refresh(id);
  return {};
}

export async function saveListLessons(id: string, lessonIds: string[]) {
  await admin();
  const list = (Array.isArray(lessonIds) ? lessonIds : []).filter(okId).slice(0, 200);
  await sql.exec(`update question_lists set lesson_ids = $2, updated_at = now() where id = $1`, [id, [...new Set(list)]]);
  refresh(id);
  revalidatePath('/aulas', 'layout');
  return {};
}

export async function lessonOptions() {
  await admin();
  return sql.query<{ id: string; title: string; folder: string }>(
    `select l.id, l.title, coalesce(f.name, '') as folder from lessons l left join lesson_folders f on f.id = l.folder_id order by f.name nulls last, l.title limit 3000`,
  );
}

// ---------------------------------------------------------------- simulado montado a partir da lista
async function buildSimulado(list: QList) {
  const all = await questionsOf(list);
  const qs = all.filter((q) => q.status !== 'anulada' && /^[A-E]$/.test(q.gabarito));
  if (!qs.length) throw new Error('A lista não tem questões com gabarito.');
  const t = await getTemplate(list.template_id);
  const pdf = await htmlToPdf(listHtml(list.title, qs, t), t);
  const key = `simulados/lista-${list.id}-${Date.now().toString(36)}.pdf`;
  await putObject('materials', key, pdf, 'application/pdf');
  const areas = qs.map((q) => q.area_sigla).filter(Boolean);
  const area =
    ['MT', 'CN', 'CH', 'LC'].find(
      (a) => areas.filter((x) => x === a).length === Math.max(...['MT', 'CN', 'CH', 'LC'].map((y) => areas.filter((x) => x === y).length)),
    ) ?? 'CN';
  return { key, count: qs.length, answer: qs.map((q) => q.gabarito).join(''), area, skipped: all.length - qs.length };
}

export async function createSimuladoFromList(listId: string, opts: { title?: string; minutes?: number }) {
  await admin();
  const list = await getList(listId);
  if (!list) return { error: 'Lista não encontrada.' };
  try {
    const s = await buildSimulado(list);
    const id = newId();
    await sql.exec(
      `insert into simulados (id, title, area, question_count, time_limit_minutes, pdf_path, is_published, use_tri, list_id) values ($1, $2, $3, $4, $5, $6, false, false, $7)`,
      [id, String(opts.title || list.title).slice(0, 160), s.area, s.count, Math.max(0, Math.min(600, Math.round(opts.minutes ?? 0))), s.key, list.id],
    );
    await sql.exec(`insert into simulado_keys (simulado_id, answer_key) values ($1, $2)`, [id, s.answer]);
    revalidatePath('/admin/simulados');
    return { id, skipped: s.skipped };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Não foi possível criar o simulado.' };
  }
}

/** Lista editada: refaz o PDF e o gabarito dos simulados dela que ainda ninguém respondeu. */
async function syncSimulados(listId: string) {
  const sims = await sql.query<{ id: string; pdf_path: string; subs: number }>(
    `select s.id, s.pdf_path, (select count(*)::int from simulado_submissions x where x.simulado_id = s.id) as subs from simulados s where s.list_id = $1`,
    [listId],
  );
  if (!sims.length) return { updated: 0, locked: 0 };
  const list = await getList(listId);
  if (!list) return { updated: 0, locked: 0 };
  let updated = 0;
  for (const sim of sims.filter((x) => !x.subs)) {
    const s = await buildSimulado(list);
    await sql.exec(`update simulados set question_count = $2, pdf_path = $3, area = $4, updated_at = now() where id = $1`, [sim.id, s.count, s.key, s.area]);
    await sql.exec(
      `insert into simulado_keys (simulado_id, answer_key) values ($1, $2) on conflict (simulado_id) do update set answer_key = excluded.answer_key`,
      [sim.id, s.answer],
    );
    await removeObjects('materials', [sim.pdf_path]);
    updated++;
  }
  revalidatePath('/admin/simulados');
  return { updated, locked: sims.length - updated };
}
