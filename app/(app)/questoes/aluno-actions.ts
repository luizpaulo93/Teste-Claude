'use server';

import { revalidatePath } from 'next/cache';
import { newId, sql } from '@/lib/db';
import { questionHtml } from '@/lib/list-html';
import { adminFilterOptions, adminSearch, adminSearchIds, getList, itemsOf, randomIds, type AdminFilters } from '@/lib/question-lists';
import { getViewer } from '@/lib/session';

async function student() {
  const v = await getViewer();
  if (!v || !(v.isMember || v.isAdmin)) throw new Error('Acesso negado.');
  return v;
}
const clean = (f: AdminFilters): AdminFilters => {
  const out: AdminFilters = {};
  for (const k of ['disciplina', 'area', 'banca', 'ano', 'habilidade', 'assunto', 'especifico', 'texto', 'prova'] as const) {
    const v = f?.[k];
    if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, 200);
  }
  return out;
};
const strs = (v: unknown, max = 60) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length < 300).slice(0, max) : []);

// mesmas buscas do professor, mas a prévia vem sem gabarito
export async function searchStudent(f: AdminFilters, page = 1) {
  await student();
  return adminSearch(clean(f), Math.max(1, Math.min(500, Math.round(page) || 1)), 30);
}
export async function idsStudent(f: AdminFilters) {
  await student();
  return adminSearchIds(clean(f));
}
export async function optionsStudent() {
  await student();
  return adminFilterOptions();
}
export async function previewStudent(id: string) {
  await student();
  const q = await sql.one<Parameters<typeof questionHtml>[0]>(
    `select q.*, p.exame, p.ano as paper_ano from questions q join exam_papers p on p.id = q.paper_id where q.id = $1`,
    [id],
  );
  return q ? { html: questionHtml(q, 0).replace(/QUESTÃO 00 ?/, '') } : null;
}
export async function itemsStudent(ids: string[]) {
  await student();
  return itemsOf(strs(ids, 300));
}

/** Salva a lista que o aluno montou escolhendo as questões. */
export async function saveMyList(input: { id?: string; title: string; ids: string[] }) {
  const v = await student();
  const title = String(input.title ?? '')
    .trim()
    .slice(0, 120);
  if (!title) return { error: 'Dê um nome para a lista.' };
  const ids = [...new Set(strs(input.ids, 150))];
  if (!ids.length) return { error: 'Escolha pelo menos uma questão.' };
  if (input.id) {
    const l = await getList(input.id);
    if (!l || l.owner_id !== v.userId) return { error: 'Lista não encontrada.' };
  }
  const id = input.id || newId();
  await sql.exec(
    `insert into question_lists (id, title, question_ids, mode, owner_id, created_by) values ($1, $2, $3, 'lista', $4, $4)
     on conflict (id) do update set title = excluded.title, question_ids = excluded.question_ids, updated_at = now()`,
    [id, title, ids, v.userId],
  );
  revalidatePath('/questoes');
  return { id };
}

/** Lista aleatória: sorteia e mistura as questões com os filtros escolhidos pelo aluno. */
export async function createRandomList(input: {
  title: string;
  count: number;
  area?: string[];
  disciplina?: string[];
  assunto?: string[];
  habilidade?: string[];
  dificuldade?: string[];
}) {
  const v = await student();
  const title = String(input.title ?? '')
    .trim()
    .slice(0, 120);
  if (!title) return { error: 'Dê um nome para a lista.' };
  const dif = strs(input.dificuldade).filter((d): d is 'facil' | 'media' | 'dificil' => ['facil', 'media', 'dificil'].includes(d));
  const ids = await randomIds(
    { area: strs(input.area), disciplina: strs(input.disciplina), assunto: strs(input.assunto), habilidade: strs(input.habilidade), dificuldade: dif },
    Number(input.count) || 20,
  );
  if (!ids.length) return { error: 'Nenhuma questão com esses filtros.' };
  const id = newId();
  await sql.exec(`insert into question_lists (id, title, question_ids, mode, owner_id, created_by) values ($1, $2, $3, 'lista', $4, $4)`, [
    id,
    title,
    ids,
    v.userId,
  ]);
  revalidatePath('/questoes');
  return { id, count: ids.length };
}

export async function deleteMyList(id: string) {
  const v = await student();
  await sql.exec(`delete from question_lists where id = $1 and owner_id = $2`, [id, v.userId]);
  revalidatePath('/questoes');
  return {};
}

/** Opções do sorteio: área, disciplina, assunto e habilidade (as que existem no banco). */
export async function randomOptions() {
  await student();
  return sql.query<{ area: string; disciplina: string; assunto_geral: string; habilidade: string }>(
    `select distinct area, disciplina, assunto_geral, habilidade from questions where status <> 'anulada'`,
  );
}
