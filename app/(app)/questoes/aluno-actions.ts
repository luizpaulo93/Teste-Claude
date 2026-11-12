'use server';

import { refresh } from 'next/cache';
import { newId, sql } from '@/lib/db';
import { questionHtml } from '@/lib/list-html';
import { adminFilterOptions, adminSearch, adminSearchIds, getList, itemsOf, randomCount, randomIds, type AdminFilters } from '@/lib/question-lists';
import { getViewer } from '@/lib/session';

async function student() {
  const v = await getViewer();
  if (!v || !(v.isMember || v.isAdmin)) throw new Error('Acesso negado.');
  return v;
}
const clean = (f: AdminFilters): AdminFilters => {
  const out: AdminFilters = {};
  // o aluno filtra por vestibular, mas não por ano (nem por prova, que já diz o ano)
  for (const k of ['vestibular', 'disciplina', 'area', 'habilidade', 'assunto', 'especifico', 'texto'] as const) {
    const v = f?.[k];
    if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, 200);
  }
  return out;
};
const strs = (v: unknown, max = 60) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length < 300).slice(0, max) : []);

// mesmas buscas do professor, mas a prévia vem sem gabarito
// para o aluno as questões vêm misturadas (nem por ano nem por banca); a mistura muda a cada dia
const seedOf = (userId: string) => `${userId}:${new Date().toISOString().slice(0, 10)}`;
export async function searchStudent(f: AdminFilters, page = 1) {
  const v = await student();
  return adminSearch(clean(f), Math.max(1, Math.min(500, Math.round(page) || 1)), 30, seedOf(v.userId));
}
export async function idsStudent(f: AdminFilters) {
  const v = await student();
  return adminSearchIds(clean(f), seedOf(v.userId));
}
export async function optionsStudent() {
  await student();
  // sem ano e banca nas opções do aluno
  const rows = await adminFilterOptions();
  const seen = new Set<string>();
  return rows
    .map((r) => ({ ...r, ano: null, banca: '' }))
    .filter((r) => {
      const k = JSON.stringify(r);
      return !seen.has(k) && Boolean(seen.add(k));
    });
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
    `insert into question_lists (id, title, question_ids, mode, owner_id, created_by) values ($1, $2, $3, 'teste', $4, $4)
     on conflict (id) do update set title = excluded.title, question_ids = excluded.question_ids, updated_at = now()`,
    [id, title, ids, v.userId],
  );
  refresh();
return { id };
}

type RandomInput = { vestibular?: string[]; area?: string[]; disciplina?: string[]; assunto?: string[]; habilidade?: string[]; dificuldade?: string[] };
const randomFilters = (input: RandomInput) => ({
  vestibular: strs(input.vestibular, 20),
  area: strs(input.area),
  disciplina: strs(input.disciplina),
  assunto: strs(input.assunto),
  habilidade: strs(input.habilidade),
  dificuldade: strs(input.dificuldade).filter((d): d is 'facil' | 'media' | 'dificil' => ['facil', 'media', 'dificil'].includes(d)),
});

/** Quantas questões o sorteio tem com esses filtros. */
export async function countRandom(input: RandomInput) {
  await student();
  return randomCount(randomFilters(input));
}

/** Lista aleatória: sorteia e mistura as questões com os filtros escolhidos pelo aluno. */
export async function createRandomList(input: {
  title: string;
  count: number;
  vestibular?: string[];
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
  const ids = await randomIds(randomFilters(input), Number(input.count) || 20);
  if (!ids.length) return { error: 'Nenhuma questão com esses filtros.' };
  const id = newId();
  await sql.exec(`insert into question_lists (id, title, question_ids, mode, owner_id, created_by) values ($1, $2, $3, 'teste', $4, $4)`, [
    id,
    title,
    ids,
    v.userId,
  ]);
  refresh();
return { id, count: ids.length };
}

export async function deleteMyList(id: string) {
  const v = await student();
  await sql.exec(`delete from question_lists where id = $1 and owner_id = $2`, [id, v.userId]);
  refresh();
return {};
}

/** Opções do sorteio: vestibular, área, disciplina, assunto e habilidade (as que existem no banco). */
export async function randomOptions() {
  await student();
  return sql.query<{ vestibular: string; area: string; disciplina: string; assunto_geral: string; habilidade: string }>(
    `select distinct vestibular, area, disciplina, assunto_geral, habilidade from questions where status <> 'anulada'`,
  );
}
