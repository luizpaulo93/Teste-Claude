import 'server-only';
import { sql } from '@/lib/db';
import { publicUrlFor, removeObjects } from '@/lib/storage/server';
import { DIFFICULTY, fileName, imagesOf, type Difficulty, type ProvaIn, type QAlternativa, type QBloco, type QImg, type QuestaoIn } from '@/lib/question-types';

export interface Paper {
  id: string;
  banca: string;
  exame: string;
  ano: number | null;
  dia: string;
  caderno: string;
  aplicacao: string;
  total: number;
  images: number;
  missing_images: number;
  updated_at: string;
}

export interface Question {
  id: string;
  paper_id: string;
  numero: number;
  banca: string;
  ano: number | null;
  area_sigla: string;
  area: string;
  disciplina: string;
  assunto_geral: string;
  assunto_especifico: string;
  competencia: string;
  habilidade: string;
  gabarito: string;
  status: 'valida' | 'anulada' | 'abandonado_na_calibracao';
  param_a: number | null;
  param_b: number | null;
  param_c: number | null;
  blocos: QBloco[];
  alternativas: QAlternativa[];
  imagem_alternativas: QImg | QImg[] | null;
  resolucao: string;
}

// ---------------------------------------------------------------- importação
const str = (v: unknown, max = 4000) => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v)).slice(0, max);
const num = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null;
const okUrl = (u: unknown) => (typeof u === 'string' && /^https?:\/\/[^\s"'<>]+$/.test(u) ? u : null);

function cleanImg(i: QImg | null | undefined): QImg | null {
  if (!i || typeof i !== 'object' || !i.arquivo) return null;
  return { arquivo: str(i.arquivo, 300), url: okUrl(i.url), largura: num(i.largura), altura: num(i.altura), alt: str(i.alt, 500) || null };
}

function cleanBloco(b: QBloco): QBloco | null {
  if (!b || typeof b !== 'object') return null;
  if (b.tipo === 'texto')
    return { tipo: 'texto', estilo: b.estilo === 'titulo' || b.estilo === 'fonte' ? b.estilo : 'corpo', conteudo: str(b.conteudo, 20000) };
  if (b.tipo === 'imagem') {
    const i = cleanImg(b);
    return i ? { tipo: 'imagem', ...i } : null;
  }
  if (b.tipo === 'equacao') return { tipo: 'equacao', latex: str(b.latex, 5000) };
  if (b.tipo === 'tabela')
    return {
      tipo: 'tabela',
      cabecalho: (Array.isArray(b.cabecalho) ? b.cabecalho : []).slice(0, 30).map((c) => str(c, 1000)),
      linhas: (Array.isArray(b.linhas) ? b.linhas : []).slice(0, 200).map((r) => (Array.isArray(r) ? r : []).slice(0, 30).map((c) => str(c, 1000))),
      legenda: str(b.legenda, 1000) || null,
    };
  return null;
}

/** Deixa a questão só com o que o app usa, sem undefined/NaN, e com as URLs das imagens que já existem. */
export function cleanQuestion(q: QuestaoIn, provaId: string, urls: Record<string, string>) {
  // imagem escolhida agora vale mais que a guardada antes (substitui)
  const withUrl = (i: QImg | null) => (i ? { ...i, url: okUrl(urls[fileName(i.arquivo)]) || okUrl(i.url) || null } : null);
  const blocos = (Array.isArray(q.blocos) ? q.blocos : [])
    .map(cleanBloco)
    .filter((b): b is QBloco => Boolean(b))
    .map((b) => (b.tipo === 'imagem' ? ({ tipo: 'imagem', ...withUrl(b)! } as QBloco) : b));
  const alternativas = (Array.isArray(q.alternativas) ? q.alternativas : []).slice(0, 6).map((a) => ({
    letra: str(a?.letra, 2).toUpperCase(),
    texto: str(a?.texto, 5000),
    imagem: withUrl(cleanImg(a?.imagem)),
  }));
  const ia = q.imagemAlternativas;
  const imagem_alternativas = Array.isArray(ia) ? ia.map((i) => withUrl(cleanImg(i))).filter(Boolean) : ia ? withUrl(cleanImg(ia)) : null;
  const numero = Math.round(num(q.numero) ?? 0);
  const status = q.status === 'anulada' || q.status === 'abandonado_na_calibracao' ? q.status : 'valida';
  return {
    id: /^[\w-]{1,140}$/.test(str(q.id)) ? str(q.id) : `${provaId}-q${String(numero).padStart(3, '0')}`,
    paper_id: provaId,
    numero,
    banca: str(q.banca, 80),
    ano: num(q.ano),
    area_sigla: str(q.areaSigla, 10),
    area: str(q.areaConhecimento, 120),
    disciplina: str(q.disciplina, 80),
    assunto_geral: str(q.assuntoGeral, 200),
    assunto_especifico: str(q.assuntoEspecifico, 400),
    competencia: str(q.competencia, 20),
    habilidade: str(q.habilidade, 20),
    gabarito: str(q.gabarito, 10).toUpperCase(),
    status,
    param_a: num(q.parametros?.a),
    param_b: num(q.parametros?.b),
    param_c: num(q.parametros?.c),
    blocos,
    alternativas,
    imagem_alternativas,
    resolucao: str(q.resolucao, 30000),
    microdados:
      q.microdados && typeof q.microdados === 'object'
        ? JSON.parse(JSON.stringify(q.microdados, (_, v) => (typeof v === 'number' && !Number.isFinite(v) ? null : v)))
        : {},
  };
}

type Row = ReturnType<typeof cleanQuestion>;
const imgsOfRow = (r: Row) => imagesOf({ ...r, imagemAlternativas: r.imagem_alternativas, numero: r.numero } as unknown as QuestaoIn);

/** Grava (ou atualiza) uma prova inteira. Reimportar não duplica: as respostas dos alunos continuam. */
export async function savePaper(p: ProvaIn, urls: Record<string, string>, userId: string) {
  const id = str(p.provaId, 120);
  if (!/^[a-z0-9][\w-]{1,119}$/i.test(id)) throw new Error(`Prova com identificador inválido: "${id}".`);
  const rows = (Array.isArray(p.questoes) ? p.questoes : []).slice(0, 400).map((q) => cleanQuestion(q, id, urls));
  if (!rows.length) throw new Error(`A prova ${id} não tem questões.`);
  const imgs = rows.flatMap(imgsOfRow);
  const missing = imgs.filter((i) => !i.url).length;
  const before = Object.values((await knownImages([id])).have[id] ?? {});
  await sql.exec(
    `insert into exam_papers (id, banca, exame, ano, dia, caderno, aplicacao, total, images, missing_images, imported_by, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
     on conflict (id) do update set banca = excluded.banca, exame = excluded.exame, ano = excluded.ano, dia = excluded.dia, caderno = excluded.caderno,
       aplicacao = excluded.aplicacao, total = excluded.total, images = excluded.images, missing_images = excluded.missing_images,
       imported_by = excluded.imported_by, updated_at = now()`,
    [id, str(p.banca, 80), str(p.exame, 80), num(p.ano), str(p.dia, 40), str(p.caderno, 80), str(p.aplicacao, 200), rows.length, imgs.length, missing, userId],
  );
  await sql.exec(
    `insert into questions (id, paper_id, numero, banca, ano, area_sigla, area, disciplina, assunto_geral, assunto_especifico, competencia, habilidade,
                            gabarito, status, param_a, param_b, param_c, blocos, alternativas, imagem_alternativas, resolucao, microdados, updated_at)
     select x.id, x.paper_id, x.numero, x.banca, x.ano, x.area_sigla, x.area, x.disciplina, x.assunto_geral, x.assunto_especifico, x.competencia, x.habilidade,
            x.gabarito, x.status, x.param_a, x.param_b, x.param_c, x.blocos, x.alternativas, x.imagem_alternativas, x.resolucao, x.microdados, now()
       from jsonb_to_recordset($1::jsonb) as x(id text, paper_id text, numero int, banca text, ano int, area_sigla text, area text, disciplina text,
            assunto_geral text, assunto_especifico text, competencia text, habilidade text, gabarito text, status text, param_a float8, param_b float8,
            param_c float8, blocos jsonb, alternativas jsonb, imagem_alternativas jsonb, resolucao text, microdados jsonb)
     on conflict (id) do update set paper_id = excluded.paper_id, numero = excluded.numero, banca = excluded.banca, ano = excluded.ano,
       area_sigla = excluded.area_sigla, area = excluded.area, disciplina = excluded.disciplina, assunto_geral = excluded.assunto_geral,
       assunto_especifico = excluded.assunto_especifico, competencia = excluded.competencia, habilidade = excluded.habilidade, gabarito = excluded.gabarito,
       status = excluded.status, param_a = excluded.param_a, param_b = excluded.param_b, param_c = excluded.param_c, blocos = excluded.blocos,
       alternativas = excluded.alternativas, imagem_alternativas = excluded.imagem_alternativas, resolucao = excluded.resolucao,
       microdados = excluded.microdados, updated_at = now()`,
    [JSON.stringify(rows)],
  );
  // questões que saíram da prova numa reimportação
  await sql.exec(`delete from questions where paper_id = $1 and not (id = any($2::text[]))`, [id, rows.map((r) => r.id)]);
  await dropUnused(before);
  return { id, questions: rows.length, images: imgs.length, missing };
}

/** URLs das imagens já guardadas no app, por nome de arquivo (para não reenviar e para encaixar imagens soltas). */
export async function knownImages(paperIds?: string[]) {
  const rows = await sql.query<{ paper_id: string; blocos: QBloco[]; alternativas: QAlternativa[]; imagem_alternativas: QImg | QImg[] | null }>(
    `select paper_id, blocos, alternativas, imagem_alternativas from questions ${paperIds ? 'where paper_id = any($1::text[])' : ''}`,
    paperIds ? [paperIds] : [],
  );
  const have: Record<string, Record<string, string>> = {};
  const want: Record<string, string[]> = {};
  for (const r of rows) {
    for (const i of imagesOf({ blocos: r.blocos, alternativas: r.alternativas, imagemAlternativas: r.imagem_alternativas } as QuestaoIn)) {
      const n = fileName(i.arquivo);
      if (i.url) (have[r.paper_id] ??= {})[n] = i.url;
      else (want[r.paper_id] ??= []).push(n);
    }
  }
  return { have, want };
}

/** Encaixa imagens enviadas depois (pelo nome do arquivo) nas questões que já estão no app. */
export async function attachImages(paperId: string, urls: Record<string, string>) {
  const rows = await sql.query<Row & { microdados: Record<string, unknown> }>(`select * from questions where paper_id = $1`, [paperId]);
  if (!rows.length) return 0;
  const replaced: string[] = [];
  // substitui também imagens que já estavam no app (ex.: versão nova da figura)
  const fix = (i: QImg | null | undefined) => {
    const u = i?.arquivo ? okUrl(urls[fileName(i.arquivo)]) : null;
    if (!i || !u || u === i.url) return i;
    if (i.url) replaced.push(i.url);
    return { ...i, url: u };
  };
  let n = 0;
  for (const r of rows) {
    const before = JSON.stringify([r.blocos, r.alternativas, r.imagem_alternativas]);
    const blocos = r.blocos.map((b) => (b.tipo === 'imagem' ? (fix(b) as QBloco) : b));
    const alternativas = r.alternativas.map((a) => ({ ...a, imagem: fix(a.imagem) ?? null }));
    const ia = Array.isArray(r.imagem_alternativas) ? r.imagem_alternativas.map((i) => fix(i)) : fix(r.imagem_alternativas as QImg | null);
    if (JSON.stringify([blocos, alternativas, ia]) === before) continue;
    n++;
    await sql.exec(`update questions set blocos = $2, alternativas = $3, imagem_alternativas = $4, updated_at = now() where id = $1`, [
      r.id,
      JSON.stringify(blocos),
      JSON.stringify(alternativas),
      ia === null || ia === undefined ? null : JSON.stringify(ia),
    ]);
  }
  await refreshPaperCounts(paperId);
  await dropUnused(replaced);
  return n;
}

/** Apaga do armazenamento as imagens antigas que nenhuma questão usa mais (sem lixo nem conflito). */
async function dropUnused(urls: string[]) {
  const base = publicUrlFor('');
  const keys: string[] = [];
  for (const u of [...new Set(urls)]) {
    if (!u.startsWith(base)) continue;
    const used = await sql.one(
      `select 1 from questions where strpos(blocos::text || alternativas::text || coalesce(imagem_alternativas::text, ''), $1) > 0 limit 1`,
      [u],
    );
    if (!used) keys.push(decodeURIComponent(u.slice(base.length)));
  }
  await removeObjects('media', keys);
}

export async function refreshPaperCounts(paperId: string) {
  const { have, want } = await knownImages([paperId]);
  const ok = Object.keys(have[paperId] ?? {}).length;
  const miss = (want[paperId] ?? []).length;
  await sql.exec(`update exam_papers set images = $2, missing_images = $3, updated_at = now() where id = $1`, [paperId, ok + miss, miss]);
}

// ---------------------------------------------------------------- banco de questões (filtros)
export interface QFilters {
  disciplina?: string;
  assunto?: string;
  especifico?: string;
  habilidade?: string;
  ano?: string;
  prova?: string;
  dif?: Difficulty | '';
  sit?: 'nao' | 'erradas' | 'certas' | '';
  q?: string;
  /** assunto do cronograma da mentoria (título da matriz): acha as questões pelas palavras do assunto */
  topico?: string;
}

const STOP = new Set([
  'para',
  'entre',
  'sobre',
  'como',
  'suas',
  'seus',
  'pela',
  'pelo',
  'pelas',
  'pelos',
  'outros',
  'outras',
  'geral',
  'gerais',
  'noções',
  'estudo',
  'conceitos',
  'aplicações',
  'tipos',
  'introdução',
  'básicos',
  'básica',
]);
/** Palavras que identificam o assunto (sem as genéricas). Depois os assuntos da matriz e das questões vão ser alinhados. */
export function topicWords(title: string) {
  return [
    ...new Set(
      title
        .toLowerCase()
        .split(/[^a-zà-ú0-9]+/i)
        .filter((w) => w.length >= 4 && !STOP.has(w)),
    ),
  ].slice(0, 8);
}

export function readFilters(sp: Record<string, string | string[] | undefined>): QFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined)) ?? '';
  const dif = one('dif');
  const sit = one('sit');
  return {
    disciplina: one('disciplina').slice(0, 80),
    assunto: one('assunto').slice(0, 200),
    especifico: one('especifico').slice(0, 400),
    habilidade: one('habilidade').slice(0, 20),
    ano: /^\d{4}$/.test(one('ano')) ? one('ano') : '',
    prova: one('prova').slice(0, 120),
    dif: DIFFICULTY.some((d) => d.key === dif) ? (dif as Difficulty) : '',
    sit: sit === 'nao' || sit === 'erradas' || sit === 'certas' ? sit : '',
    q: one('q').slice(0, 80),
    topico: one('topico').slice(0, 200),
  };
}

export function filterQuery(f: QFilters, extra: Record<string, string> = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...extra })) if (v) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

function where(f: QFilters, userId: string) {
  const conds: string[] = [];
  const args: unknown[] = [userId];
  const add = (sqlText: string, v: unknown) => {
    args.push(v);
    conds.push(sqlText.replace('$?', `$${args.length}`));
  };
  if (f.disciplina) add('q.disciplina = $?', f.disciplina);
  if (f.assunto) add('q.assunto_geral = $?', f.assunto);
  if (f.prova) add('q.paper_id = $?', f.prova);
  if (f.dif) {
    const i = DIFFICULTY.findIndex((d) => d.key === f.dif);
    const lo = i > 0 ? DIFFICULTY[i - 1].max : -Infinity;
    const hi = DIFFICULTY[i].max;
    if (Number.isFinite(lo)) add('q.param_b >= $?', lo);
    if (Number.isFinite(hi)) add('q.param_b < $?', hi);
    conds.push('q.param_b is not null');
  }
  if (f.sit === 'nao') conds.push('a.question_id is null');
  if (f.sit === 'erradas') conds.push('a.correct = false');
  if (f.sit === 'certas') conds.push('a.correct = true');
  if (f.topico) {
    const words = topicWords(f.topico);
    if (words.length) {
      args.push(words.map((w) => `%${w}%`));
      const n = `$${args.length}`;
      conds.push(`(q.assunto_geral ilike any(${n}::text[]) or q.assunto_especifico ilike any(${n}::text[]))`);
    }
  }
  if (f.especifico) add('q.assunto_especifico = $?', f.especifico);
  if (f.habilidade) add('q.habilidade = $?', f.habilidade);
  if (f.ano) add('coalesce(q.ano, p.ano) = $?', Number(f.ano));
  // trecho: enunciado, alternativas, assuntos ou habilidade
  if (f.q) {
    args.push(`%${f.q.replace(/[%_]/g, (c) => `\\${c}`)}%`);
    const n = `$${args.length}`;
    conds.push(
      `(q.blocos::text ilike ${n} or q.alternativas::text ilike ${n} or q.assunto_especifico ilike ${n} or q.assunto_geral ilike ${n} or q.habilidade ilike ${n})`,
    );
  }
  return { sql: conds.length ? `where ${conds.join(' and ')}` : '', args };
}

export interface QListItem {
  id: string;
  paper_id: string;
  numero: number;
  ano: number | null;
  disciplina: string;
  assunto_geral: string;
  assunto_especifico: string;
  habilidade: string;
  status: string;
  param_b: number | null;
  snippet: string;
  correct: boolean | null;
  aplicacao: string;
  exame: string;
}

const ORDER = 'order by p.ano desc nulls last, p.id, q.numero';

export async function listQuestions(f: QFilters, userId: string, page = 1, perPage = 30) {
  const w = where(f, userId);
  const args = w.args;
  const base = `from questions q join exam_papers p on p.id = q.paper_id left join question_answers a on a.question_id = q.id and a.user_id = $1 ${w.sql}`;
  const [items, total] = await Promise.all([
    sql.query<QListItem>(
      `select q.id, q.paper_id, q.numero, coalesce(q.ano, p.ano) as ano, q.disciplina, q.assunto_geral, q.assunto_especifico, q.habilidade, q.status, q.param_b,
              left(coalesce((select string_agg(b->>'conteudo', ' ') from jsonb_array_elements(q.blocos) b where b->>'tipo' = 'texto'), ''), 220) as snippet,
              a.correct, p.aplicacao, p.exame
         ${base} ${ORDER} limit ${perPage} offset ${(Math.max(1, page) - 1) * perPage}`,
      args,
    ),
    sql.one<{ n: number }>(`select count(*)::int as n ${base}`, args),
  ]);
  return { items, total: total?.n ?? 0 };
}

/** Questões anterior e seguinte dentro do mesmo filtro (para ir de uma em uma). */
export async function neighbors(f: QFilters, userId: string, id: string) {
  const w = where(f, userId);
  const args = w.args;
  const ids = await sql.query<{ id: string }>(
    `select q.id from questions q join exam_papers p on p.id = q.paper_id left join question_answers a on a.question_id = q.id and a.user_id = $1 ${w.sql} ${ORDER}`,
    args,
  );
  const i = ids.findIndex((r) => r.id === id);
  return { prev: i > 0 ? ids[i - 1].id : null, next: i >= 0 && i < ids.length - 1 ? ids[i + 1].id : null, pos: i + 1, total: ids.length };
}

export const getQuestion = (id: string) =>
  sql.one<Question & { paper: Paper }>(`select q.*, to_jsonb(p) as paper from questions q join exam_papers p on p.id = q.paper_id where q.id = $1`, [id]);

export interface FilterRow {
  disciplina: string;
  assunto_geral: string;
  assunto_especifico: string;
  habilidade: string;
  ano: number | null;
  paper_id: string;
}

export async function filterOptions() {
  const [rows, papers] = await Promise.all([
    sql.query<FilterRow>(
      `select distinct q.disciplina, q.assunto_geral, q.assunto_especifico, q.habilidade, coalesce(q.ano, p.ano) as ano, q.paper_id
         from questions q join exam_papers p on p.id = q.paper_id where q.disciplina <> ''`,
    ),
    sql.query<Paper>(`select * from exam_papers order by ano desc nulls last, id`),
  ]);
  return { rows, papers };
}

export const paperLabel = (p: Pick<Paper, 'exame' | 'ano' | 'dia' | 'aplicacao'>) =>
  [p.exame, p.ano, p.dia].filter(Boolean).join(' ') + (p.aplicacao ? ` · ${p.aplicacao.replace(/^Aplicação\s+/i, '')}` : '');
