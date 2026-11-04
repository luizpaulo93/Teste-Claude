import 'server-only';
import { sql } from '@/lib/db';
import { audienceMatch } from '@/lib/live';
import type { Question } from '@/lib/questions';
import type { Viewer } from '@/lib/session';

export interface ListTemplate {
  id: string;
  name: string;
  /** modelo das apostilas do curso: vai nos PDFs que o aluno baixa */
  is_default?: boolean;
  header_url: string;
  header_w: number | null;
  header_h: number | null;
  footer_url: string;
  footer_w: number | null;
  footer_h: number | null;
  /** cabeçalho das páginas depois da 1ª (vazio = sem cabeçalho nelas) */
  header_rest_url?: string;
  header_rest_w?: number | null;
  header_rest_h?: number | null;
  /** o mesmo cabeçalho em todas as páginas */
  header_all?: boolean;
}

/** Qual imagem vai no alto da 1ª página e das demais. */
export function headersOf(t: ListTemplate | null) {
  if (!t) return { first: null, rest: null };
  const img = (url: string | undefined, w: number | null | undefined, h: number | null | undefined) => (url && w && h ? { url, w, h } : null);
  const first = img(t.header_url, t.header_w, t.header_h);
  const rest = t.header_all ? first : img(t.header_rest_url, t.header_rest_w, t.header_rest_h);
  return { first, rest };
}

export interface QList {
  id: string;
  title: string;
  question_ids: string[];
  template_id: string | null;
  mode: 'lista' | 'teste';
  audience: string[];
  lesson_ids: string[];
  /** lista montada pelo próprio aluno (só ele vê) */
  owner_id?: string | null;
  /** teste do professor: a resolução só aparece depois que ele liberar */
  resolution_released?: boolean;
  updated_at: string;
}

/** Resolução livre? Lista do próprio aluno ou lista comum: sim. Teste do professor: só depois de liberar. */
export const resolutionOpen = (l: Pick<QList, 'owner_id' | 'mode' | 'resolution_released'>) =>
  Boolean(l.owner_id) || l.mode === 'lista' || Boolean(l.resolution_released);

export const getList = (id: string) => sql.one<QList>(`select * from question_lists where id = $1`, [id]);
export const getTemplate = (id: string | null) => (id ? sql.one<ListTemplate>(`select * from list_templates where id = $1`, [id]) : Promise.resolve(null));
export const allTemplates = () => sql.query<ListTemplate>(`select * from list_templates order by is_default desc, name`);
export const defaultTemplate = () => sql.one<ListTemplate>(`select * from list_templates where is_default limit 1`);

/** Questões da lista, na ordem escolhida (questões apagadas do banco somem sozinhas). */
export async function questionsOf(list: Pick<QList, 'question_ids'>) {
  if (!list.question_ids.length) return [];
  const rows = await sql.query<Question & { paper_label: string; exame: string; paper_ano: number | null }>(
    `select q.*, p.exame, p.ano as paper_ano, p.aplicacao as paper_label from questions q join exam_papers p on p.id = q.paper_id where q.id = any($1::text[])`,
    [list.question_ids],
  );
  const by = new Map(rows.map((r) => [r.id, r]));
  return list.question_ids.map((id) => by.get(id)).filter((q): q is NonNullable<typeof q> => Boolean(q));
}

/** Aluno vê a lista se ela foi mandada para ele (turma, mentoria, nome) ou está numa aula. Admin vê todas. */
export async function canSeeList(viewer: Viewer, list: QList) {
  if (viewer.isAdmin) return true;
  if (list.owner_id) return list.owner_id === viewer.userId;
  for (const t of list.audience) if (await audienceMatch(viewer, t)) return true;
  if (list.lesson_ids.length && viewer.isMember) return true;
  return false;
}

export async function listsForViewer(viewer: Viewer) {
  const all = await sql.query<QList>(`select * from question_lists where owner_id is null and cardinality(audience) > 0 order by updated_at desc limit 300`);
  const ok = await Promise.all(
    all.map(async (l) => (viewer.isAdmin ? true : (await Promise.all(l.audience.map((t) => audienceMatch(viewer, t)))).some(Boolean))),
  );
  return all.filter((_, i) => ok[i]);
}

/** Listas que o aluno montou (aleatória ou escolhendo), com quantas ele já respondeu. */
export const myLists = (userId: string) =>
  sql.query<QList & { answered: number; right: number; finished: boolean }>(
    `select l.*, exists (select 1 from list_finishes f where f.list_id = l.id and f.user_id = $1) as finished,
            (select count(*)::int from list_responses r where r.list_id = l.id and r.user_id = $1) as answered,
            (select count(*)::int from list_responses r where r.list_id = l.id and r.user_id = $1 and r.correct) as "right"
       from question_lists l where l.owner_id = $1 order by l.created_at desc limit 200`,
    [userId],
  );

export const listsOfLesson = (lessonId: string) =>
  sql.query<Pick<QList, 'id' | 'title' | 'question_ids' | 'mode'>>(
    `select id, title, question_ids, mode from question_lists where $1 = any(lesson_ids) order by updated_at desc`,
    [lessonId],
  );

// ---------------------------------------------------------------- busca do admin (montar listas, excluir)
export interface AdminFilters {
  disciplina?: string;
  area?: string;
  banca?: string;
  ano?: string;
  habilidade?: string;
  assunto?: string;
  especifico?: string;
  texto?: string;
  prova?: string;
}

export interface AdminItem {
  id: string;
  disciplina: string;
  area: string;
  banca: string;
  ano: number | null;
  habilidade: string;
  assunto_geral: string;
  assunto_especifico: string;
  status: string;
  param_b: number | null;
  snippet: string;
  aplicacao: string;
  exame: string;
}

function adminWhere(f: AdminFilters) {
  const conds: string[] = [];
  const args: unknown[] = [];
  const eq = (col: string, v?: string) => {
    if (!v) return;
    args.push(v);
    conds.push(`${col} = $${args.length}`);
  };
  eq('q.disciplina', f.disciplina);
  eq('q.area', f.area);
  eq(`coalesce(nullif(q.banca, ''), p.banca)`, f.banca);
  eq('q.habilidade', f.habilidade);
  eq('q.assunto_geral', f.assunto);
  eq('q.assunto_especifico', f.especifico);
  eq('q.paper_id', f.prova);
  if (f.ano && /^\d{4}$/.test(f.ano)) {
    args.push(Number(f.ano));
    conds.push(`coalesce(q.ano, p.ano) = $${args.length}`);
  }
  if (f.texto?.trim()) {
    args.push(`%${f.texto.trim().replace(/[%_]/g, (c) => `\\${c}`)}%`);
    const n = `$${args.length}`;
    conds.push(`(q.blocos::text ilike ${n} or q.alternativas::text ilike ${n} or q.assunto_especifico ilike ${n} or q.assunto_geral ilike ${n})`);
  }
  return { where: conds.length ? `where ${conds.join(' and ')}` : '', args };
}

const ADMIN_ORDER = 'order by coalesce(q.ano, p.ano) desc nulls last, p.id, q.numero';

/** `seed`: ordem misturada (estável para a mesma semente, então a paginação não repete questões). */
export async function adminSearch(f: AdminFilters, page = 1, per = 30, seed?: string) {
  const w = adminWhere(f);
  const order = seed ? `order by md5(q.id || $${w.args.push(seed)})` : ADMIN_ORDER;
  const base = `from questions q join exam_papers p on p.id = q.paper_id ${w.where}`;
  const [items, total] = await Promise.all([
    sql.query<AdminItem>(
      `select q.id, q.disciplina, q.area, coalesce(nullif(q.banca, ''), p.banca) as banca, coalesce(q.ano, p.ano) as ano, q.habilidade, q.assunto_geral,
              q.assunto_especifico, q.status, q.param_b, p.aplicacao, p.exame,
              left(coalesce((select string_agg(b->>'conteudo', ' ') from jsonb_array_elements(q.blocos) b where b->>'tipo' = 'texto'), ''), 260) as snippet
         ${base} ${order} limit ${per} offset ${(Math.max(1, page) - 1) * per}`,
      w.args,
    ),
    sql.one<{ n: number }>(`select count(*)::int as n ${base}`, seed ? w.args.slice(0, -1) : w.args),
  ]);
  return { items, total: total?.n ?? 0 };
}

/** Dados para mostrar as questões escolhidas, na ordem da lista. */
export async function itemsOf(ids: string[]) {
  if (!ids.length) return [];
  const rows = await sql.query<AdminItem>(
    `select q.id, q.disciplina, q.area, coalesce(nullif(q.banca, ''), p.banca) as banca, coalesce(q.ano, p.ano) as ano, q.habilidade, q.assunto_geral,
            q.assunto_especifico, q.status, q.param_b, p.aplicacao, p.exame,
            left(coalesce((select string_agg(b->>'conteudo', ' ') from jsonb_array_elements(q.blocos) b where b->>'tipo' = 'texto'), ''), 260) as snippet
       from questions q join exam_papers p on p.id = q.paper_id where q.id = any($1::text[])`,
    [ids],
  );
  const by = new Map(rows.map((r) => [r.id, r]));
  return ids.map((i) => by.get(i)).filter((x): x is AdminItem => Boolean(x));
}

/** Todos os ids do filtro (para "selecionar todas" e para excluir em lote). */
export async function adminSearchIds(f: AdminFilters, seed?: string) {
  const w = adminWhere(f);
  const order = seed ? `order by md5(q.id || $${w.args.push(seed)})` : ADMIN_ORDER;
  return (
    await sql.query<{ id: string }>(`select q.id from questions q join exam_papers p on p.id = q.paper_id ${w.where} ${order} limit 5000`, w.args)
  ).map((r) => r.id);
}

export async function adminFilterOptions() {
  const rows = await sql.query<{
    disciplina: string;
    area: string;
    banca: string;
    ano: number | null;
    habilidade: string;
    assunto_geral: string;
    assunto_especifico: string;
  }>(
    `select distinct q.disciplina, q.area, coalesce(nullif(q.banca, ''), p.banca) as banca, coalesce(q.ano, p.ano) as ano, q.habilidade, q.assunto_geral, q.assunto_especifico
       from questions q join exam_papers p on p.id = q.paper_id`,
  );
  return rows;
}

/** Exclui questões do banco (e tira das listas onde estavam). */
export async function deleteQuestions(ids: string[]) {
  if (!ids.length) return 0;
  const papers = await sql.query<{ paper_id: string }>(`select distinct paper_id from questions where id = any($1::text[])`, [ids]);
  const r = await sql.query<{ id: string }>(`delete from questions where id = any($1::text[]) returning id`, [ids]);
  await sql.exec(
    `update question_lists set question_ids = array(select x from unnest(question_ids) with ordinality as t(x, o) where not (x = any($1::text[])) order by o), updated_at = now()
      where question_ids && $1::text[]`,
    [ids],
  );
  await sql.exec(
    `update exam_papers p set total = (select count(*)::int from questions q where q.paper_id = p.id), updated_at = now() where id = any($1::text[])`,
    [papers.map((p) => p.paper_id)],
  );
  return r.length;
}

// ---------------------------------------------------------------- lista aleatória do aluno
export interface RandomFilters {
  area?: string[];
  disciplina?: string[];
  assunto?: string[];
  habilidade?: string[];
  dificuldade?: ('facil' | 'media' | 'dificil')[];
}

/** Máximo de questões numa lista aleatória. */
export const RANDOM_MAX = 45;

function randomWhere(f: RandomFilters) {
  const conds = [`q.status <> 'anulada'`];
  const args: unknown[] = [];
  const any = (col: string, v?: string[]) => {
    if (!v?.length) return;
    args.push(v);
    conds.push(`${col} = any($${args.length}::text[])`);
  };
  any('q.area', f.area);
  any('q.disciplina', f.disciplina);
  any('q.assunto_geral', f.assunto);
  any('q.habilidade', f.habilidade);
  if (f.dificuldade?.length) {
    const ors = f.dificuldade.map((d) => (d === 'facil' ? 'q.param_b < 0.8' : d === 'media' ? '(q.param_b >= 0.8 and q.param_b < 1.6)' : 'q.param_b >= 1.6'));
    conds.push(`(${ors.join(' or ')})`);
  }
  return { where: conds.join(' and '), args };
}

/** Sorteia questões que batem com os filtros (vários valores por campo), já misturadas. Anuladas ficam de fora. */
export async function randomIds(f: RandomFilters, count: number) {
  const w = randomWhere(f);
  const rows = await sql.query<{ id: string }>(
    `select q.id from questions q where ${w.where} order by random() limit ${Math.max(1, Math.min(RANDOM_MAX, Math.round(count) || 20))}`,
    w.args,
  );
  return rows.map((r) => r.id);
}

/** Quantas questões existem com esses filtros (para limitar a quantidade no sorteio). */
export async function randomCount(f: RandomFilters) {
  const w = randomWhere(f);
  return (await sql.one<{ n: number }>(`select count(*)::int as n from questions q where ${w.where}`, w.args))?.n ?? 0;
}
