import 'server-only';
import { newId, sql } from '@/lib/db';
import { shift, todayBR } from '@/lib/mentoria';
import { ASSUNTO_BY_KEY, DISCIPLINE_NAME } from '@/lib/trilha-catalog';

/**
 * Trilha da mentoria por níveis. Cada assunto passa por:
 *   0 Teoria → 1 Nível 1 (básicas) → 2 Nível 2 (elaboradas, abaixo do ENEM) → 3 Nível 3 (ENEM) → 4 Dominado.
 * Em cada nível o app cria uma lista (5, 10 ou 15 questões, escolha do aluno). Passa com mais da metade;
 * senão fica retido e recebe outra lista do mesmo nível (questões novas), até passar.
 * Assuntos estudados voltam dentro das listas da mesma disciplina:
 *  - com dificuldade (ficou retido 2 vezes ou errou na revisão): toda semana, até acertar 2 revisões seguidas;
 *  - dominado com facilidade: pelo menos 1 questão a cada 2 semanas.
 * Se nenhuma lista da disciplina levar a revisão, o app cria a "Revisão da semana" da disciplina.
 */
export const TRAIL_LEVELS = ['Teoria', 'Nível 1', 'Nível 2', 'Nível 3', 'Dominado'] as const;
export const LEVEL_HINT = [
  'Estudar a teoria do assunto',
  'Questões básicas',
  'Questões elaboradas, com interpretação, um pouco abaixo do ENEM',
  'Nível ENEM: interpretação e distratores',
  'Volta de tempos em tempos para não esquecer',
] as const;
export const LIST_SIZES = [5, 10, 15] as const;
/** Passa de nível com mais da metade (3 de 5, 6 de 10, 8 de 15). */
export const passedList = (ok: number, total: number) => total > 0 && ok * 2 > total;
/** Dias até a lista do próximo nível aparecer na agenda (depois de passar no 1 e no 2). */
const GAP_AFTER_PASS = [0, 2, 4];
const REVIEW_HARD = 7;
const REVIEW_EASY = 14;
/** Revisões dentro de uma lista do assunto: no máximo 3 questões de outros assuntos */
const MAX_REVIEW_IN_LIST = 3;
/** Revisão atrasada há tantos dias sem nenhuma lista da disciplina para levar: vira a "Revisão da semana" */
const WEEKLY_AFTER = 3;

/**
 * Nível de uma questão (1 básica, 2 intermediária, 3 nível ENEM; 0 sem classificação):
 * ENEM pela TRI (parâmetro b); vestibulares pela dificuldade que veio no JSON.
 */
export const LEVEL_SQL = `(case
  when q.vestibular = 'ENEM' and q.param_b is not null then (case when q.param_b < 0.8 then 1 when q.param_b < 1.6 then 2 else 3 end)
  when q.dificuldade = 'facil' then 1 when q.dificuldade = 'media' then 2 when q.dificuldade = 'dificil' then 3
  when q.param_b is not null then (case when q.param_b < 0.8 then 1 when q.param_b < 1.6 then 2 else 3 end)
  else 0 end)`;

export interface TrailCard {
  id: string;
  mentoria_id: string;
  item_key: string;
  discipline: string;
  title: string;
  level: number;
  list_size: number;
  retained: number;
  retained_total: number;
  hard: boolean;
  review_ok: number;
  next_review: string | null;
  history: unknown[];
}

export interface TrailList {
  id: string;
  mentoria_id: string;
  card_id: string | null;
  item_key: string;
  discipline: string;
  level: number;
  round: number;
  list_id: string;
  main_ids: string[];
  off_level: number;
  review: { q: string; k: string }[];
  status: 'open' | 'passed' | 'failed' | 'done' | 'closed';
  ok: number | null;
  total: number | null;
  created_at: string;
  finished_at: string | null;
}

const CARD_COLS = `id, mentoria_id, item_key, discipline, title, level, list_size, retained, retained_total, hard, review_ok,
  next_review::text as next_review, history`;

const getCard = (mentoriaId: string, id: string) =>
  sql.one<TrailCard>(`select ${CARD_COLS} from mentoria_cards where id = $1 and mentoria_id = $2`, [id, mentoriaId]);

/** Nome da disciplina e do assunto como estão no banco de questões */
function bankOf(itemKey: string, discipline: string, title: string) {
  const a = ASSUNTO_BY_KEY.get(itemKey);
  return { disciplina: DISCIPLINE_NAME[discipline] ?? discipline, assunto: a?.title ?? title, short: a?.short ?? title };
}

/**
 * Questões do assunto para um nível: primeiro as do nível certo, depois as dos níveis vizinhos (e as sem
 * classificação); dentro disso, as que o aluno ainda não viu na trilha. Se o banco acabar, repete as já vistas.
 */
async function pick(mentoriaId: string, itemKey: string, disciplina: string, assunto: string, level: number, n: number, exclude: string[] = []) {
  const rows = await sql.query<{ id: string; lv: number }>(
    `with seen as (
       select distinct unnest(main_ids || array(select x ->> 'q' from jsonb_array_elements(review) x)) as id
         from mentoria_trail_lists where mentoria_id = $1
     )
     select q.id, ${LEVEL_SQL} as lv
       from questions q
      where q.status <> 'anulada' and q.disciplina = $2 and q.assunto_geral = $3 and not (q.id = any($5::text[]))
      order by (case when ${LEVEL_SQL} = $4 then 0 when ${LEVEL_SQL} = 0 then 1 else abs(${LEVEL_SQL} - $4) end),
               (q.id in (select id from seen)), random()
      limit $6`,
    [mentoriaId, disciplina, assunto, level, exclude, n],
  );
  void itemKey;
  return { ids: rows.map((r) => r.id), off: rows.filter((r) => r.lv !== level).length };
}

/** Assuntos da mesma disciplina que precisam voltar (revisão vencida), os com dificuldade primeiro. */
const dueReviews = (mentoriaId: string, discipline: string, exceptKey: string, today: string) =>
  sql.query<TrailCard>(
    `select ${CARD_COLS} from mentoria_cards
      where mentoria_id = $1 and discipline = $2 and item_key <> $3 and next_review is not null and next_review <= $4
        and (level >= 4 or (hard and level >= 1))
      order by hard desc, next_review limit ${MAX_REVIEW_IN_LIST}`,
    [mentoriaId, discipline, exceptKey, today],
  );

/** Escolhe as questões de revisão (1 por assunto; 2 se ele estiver com dificuldade) e marca a próxima vez. */
async function reviewQuestions(mentoriaId: string, cards: TrailCard[], exclude: string[], cap: number, today: string) {
  const out: { q: string; k: string }[] = [];
  for (const c of cards) {
    if (out.length >= cap) break;
    const b = bankOf(c.item_key, c.discipline, c.title);
    const want = Math.min(cap - out.length, c.hard ? 2 : 1);
    const lv = Math.min(3, Math.max(1, c.level >= 4 ? 3 : c.level));
    const r = await pick(mentoriaId, c.item_key, b.disciplina, b.assunto, lv, want, [...exclude, ...out.map((x) => x.q)]);
    for (const q of r.ids) out.push({ q, k: c.item_key });
    if (r.ids.length)
      await sql.exec(`update mentoria_cards set next_review = $3 where id = $1 and mentoria_id = $2`, [c.id, mentoriaId, shift(today, c.hard ? REVIEW_HARD : REVIEW_EASY)]);
  }
  return out;
}

async function insertList(mentoriaId: string, title: string, ids: string[]) {
  const listId = newId();
  await sql.exec(
    `insert into question_lists (id, title, question_ids, mode, audience, resolution_released, created_by)
     values ($1, $2, $3, 'teste', $4, true, 'Mentoria')`,
    [listId, title.slice(0, 120), ids, [`u:${mentoriaId}`]],
  );
  return listId;
}

/** Cria a lista do nível atual do assunto (com as revisões da disciplina no fim). */
export async function createTrailList(mentoriaId: string, cardId: string) {
  const c = await getCard(mentoriaId, cardId);
  if (!c || c.level < 1 || c.level > 3) return null;
  const today = todayBR();
  const b = bankOf(c.item_key, c.discipline, c.title);
  const size = LIST_SIZES.includes(c.list_size as 5) ? c.list_size : 5;
  const main = await pick(mentoriaId, c.item_key, b.disciplina, b.assunto, c.level, size);
  if (!main.ids.length) return null;
  const review = await reviewQuestions(mentoriaId, await dueReviews(mentoriaId, c.discipline, c.item_key, today), main.ids, MAX_REVIEW_IN_LIST, today);
  const prev = await sql.one<{ n: number }>(`select count(*)::int as n from mentoria_trail_lists where card_id = $1 and level = $2`, [c.id, c.level]);
  const round = (prev?.n ?? 0) + 1;
  const listId = await insertList(
    mentoriaId,
    `${TRAIL_LEVELS[c.level]} · ${b.short}${round > 1 ? ` (${round}ª lista)` : ''}`,
    [...main.ids, ...review.map((r) => r.q)],
  );
  const id = newId();
  await sql.exec(
    `insert into mentoria_trail_lists (id, mentoria_id, card_id, item_key, discipline, level, round, list_id, main_ids, off_level, review)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [id, mentoriaId, c.id, c.item_key, c.discipline, c.level, round, listId, main.ids, main.off, JSON.stringify(review)],
  );
  return { id, listId, round, count: main.ids.length, review: review.length };
}

/** Lista aberta do assunto (a que o aluno está fazendo agora). */
export const openListOf = (cardId: string) =>
  sql.one<TrailList>(`select * from mentoria_trail_lists where card_id = $1 and status = 'open' order by created_at desc limit 1`, [cardId]);

/** Fecha a lista aberta do assunto: se o aluno nem começou, ela some; se começou, fica guardada. */
async function closeOpen(mentoriaId: string, cardId: string) {
  const open = await sql.query<{ list_id: string; started: boolean }>(
    `select t.list_id, exists (select 1 from list_responses r where r.list_id = t.list_id) as started
       from mentoria_trail_lists t where t.card_id = $1 and t.mentoria_id = $2 and t.status = 'open'`,
    [cardId, mentoriaId],
  );
  for (const o of open)
    if (o.started) await sql.exec(`update mentoria_trail_lists set status = 'closed', finished_at = now() where list_id = $1`, [o.list_id]);
    else await sql.exec(`delete from question_lists where id = $1`, [o.list_id]);
}

/**
 * Leva o assunto para um nível (mentor arrastando no quadro, ou aluno que terminou a teoria).
 * Níveis 1 a 3 já recebem a lista na hora; dominado entra nas revisões.
 */
export async function setTrailLevel(mentoriaId: string, cardId: string, level: number) {
  const c = await getCard(mentoriaId, cardId);
  if (!c) return { error: 'Assunto não encontrado.' };
  const to = Math.max(0, Math.min(4, Math.round(level)));
  const today = todayBR();
  await closeOpen(mentoriaId, cardId);
  await sql.exec(
    `update mentoria_cards set level = $3, step = 'study', retained = 0, updated_at = now(),
            due_on = case when $3 between 1 and 3 then $4::date else null end,
            mastered_on = case when $3 = 4 then coalesce(mastered_on, $4::date) else null end,
            next_review = case when $3 = 4 then $5::date when $3 = 0 then null else next_review end
      where id = $1 and mentoria_id = $2`,
    [cardId, mentoriaId, to, today, shift(today, c.hard ? REVIEW_HARD : REVIEW_EASY)],
  );
  const made = to >= 1 && to <= 3 ? await createTrailList(mentoriaId, cardId) : null;
  return { ok: true as const, level: to, listId: made?.listId ?? null, noQuestions: to >= 1 && to <= 3 && !made };
}

/** Muda o tamanho das listas do assunto (5, 10 ou 15); a lista aberta ainda não começada é refeita. */
export async function setTrailSize(mentoriaId: string, cardId: string, size: number) {
  if (!LIST_SIZES.includes(size as 5)) return { error: 'Escolha 5, 10 ou 15 questões.' };
  const c = await getCard(mentoriaId, cardId);
  if (!c) return { error: 'Assunto não encontrado.' };
  await sql.exec(`update mentoria_cards set list_size = $3, updated_at = now() where id = $1 and mentoria_id = $2`, [cardId, mentoriaId, size]);
  const open = await openListOf(cardId);
  if (open && !(await sql.one(`select 1 from list_responses where list_id = $1 limit 1`, [open.list_id]))) {
    // a mesma tentativa, só com outro tamanho: as revisões que ela levava voltam para a fila
    await sql.exec(`delete from question_lists where id = $1`, [open.list_id]);
    if (open.review.length)
      await sql.exec(`update mentoria_cards set next_review = $3 where mentoria_id = $1 and item_key = any($2)`, [
        mentoriaId,
        [...new Set(open.review.map((r) => r.k))],
        todayBR(),
      ]);
    const made = await createTrailList(mentoriaId, cardId);
    return { ok: true as const, listId: made?.listId ?? null };
  }
  return { ok: true as const, listId: open?.list_id ?? null };
}

/** Mentor: outra lista do nível atual agora (a aberta, se o aluno ainda não começou, é trocada). */
export async function newTrailList(mentoriaId: string, cardId: string) {
  await closeOpen(mentoriaId, cardId);
  const made = await createTrailList(mentoriaId, cardId);
  return made ? { ok: true as const, listId: made.listId } : { error: 'Não há questões deste assunto no banco.' };
}

export interface TrailResult {
  trail: true;
  passed: boolean;
  ok: number;
  total: number;
  /** nível em que o assunto ficou */
  level: number;
  /** próxima lista (do próximo nível ou outra do mesmo nível) */
  next: string | null;
  title: string;
  review: boolean;
}

/**
 * O aluno terminou uma lista da trilha: as questões do assunto decidem se passa de nível; as de revisão
 * só atualizam os assuntos revisados. Já cria a próxima lista (próximo nível, ou outra do mesmo nível).
 */
export async function afterTrailList(listId: string, userId: string): Promise<TrailResult | null> {
  const t = await sql.one<TrailList>(`select * from mentoria_trail_lists where list_id = $1 and status = 'open'`, [listId]);
  if (!t) return null;
  const answers = await sql.query<{ question_id: string; correct: boolean }>(
    `select r.question_id, r.correct from list_responses r join questions q on q.id = r.question_id
      where r.list_id = $1 and r.user_id = $2 and q.status <> 'anulada'`,
    [listId, userId],
  );
  const right = new Map(answers.map((a) => [a.question_id, a.correct]));
  const valid = await sql.query<{ id: string }>(`select id from questions where id = any($1) and status <> 'anulada'`, [t.main_ids]);
  const total = valid.length;
  const ok = valid.filter((q) => right.get(q.id)).length;
  const today = todayBR();

  // revisões: errou → o assunto fica com dificuldade e volta em 1 semana; acertou 2 seguidas → sai da dificuldade
  for (const r of t.review) {
    const correct = right.get(r.q) === true;
    // (no update os valores da direita são os de antes)
    await sql.exec(
      `update mentoria_cards set
          review_ok = case when $3 then review_ok + 1 else 0 end,
          hard = case when $3 then hard and review_ok + 1 < 2 else true end,
          next_review = case when $3 and not (hard and review_ok + 1 < 2) then $5::date else $4::date end,
          updated_at = now()
        where mentoria_id = $1 and item_key = $2 and level >= 1`,
      [t.mentoria_id, r.k, correct, shift(today, REVIEW_HARD), shift(today, REVIEW_EASY)],
    );
  }

  // revisão da semana: não mexe em nível
  if (t.level === 0 || !t.card_id) {
    await sql.exec(`update mentoria_trail_lists set status = 'done', ok = $2, total = $3, finished_at = now() where id = $1`, [t.id, ok, total]);
    return { trail: true, passed: true, ok, total, level: 0, next: null, title: 'Revisão', review: true };
  }

  const c = await getCard(t.mentoria_id, t.card_id);
  if (!c) return null;
  const passed = passedList(ok, total);
  await sql.exec(`update mentoria_trail_lists set status = $2, ok = $3, total = $4, finished_at = now() where id = $1`, [
    t.id,
    passed ? 'passed' : 'failed',
    ok,
    total,
  ]);
  const history = [...(Array.isArray(c.history) ? c.history : []), { d: today, q: total, c: ok, l: c.level, r: t.round, p: passed ? 1 : 0 }].slice(-40);
  const b = bankOf(c.item_key, c.discipline, c.title);

  if (passed) {
    const level = Math.min(4, c.level + 1);
    const mastered = level === 4;
    // dominou: com facilidade (no máximo 1 lista repetida na trilha toda) volta a cada 2 semanas; com dificuldade, toda semana
    const hard = mastered ? c.retained_total >= 2 : false;
    await sql.exec(
      `update mentoria_cards set level = $3, retained = 0, step = 'study', last_acc = $4, attempts = attempts + 1, history = $5,
              hard = $6, review_ok = 0,
              due_on = $7, mastered_on = case when $8 then $9::date else mastered_on end,
              next_review = case when $8 then $10::date else next_review end, updated_at = now()
        where id = $1 and mentoria_id = $2`,
      [
        c.id,
        t.mentoria_id,
        level,
        Math.round((ok / Math.max(1, total)) * 100),
        JSON.stringify(history),
        hard,
        mastered ? null : shift(today, GAP_AFTER_PASS[c.level] ?? 2),
        mastered,
        today,
        shift(today, hard ? REVIEW_HARD : REVIEW_EASY),
      ],
    );
    const next = mastered ? null : await createTrailList(t.mentoria_id, c.id);
    return { trail: true, passed, ok, total, level, next: next?.listId ?? null, title: b.short, review: false };
  }

  // retido: outra lista do mesmo nível (questões novas); 2 listas seguidas sem passar = assunto com dificuldade
  await sql.exec(
    `update mentoria_cards set retained = retained + 1, retained_total = retained_total + 1, hard = hard or retained + 1 >= 2,
            last_acc = $3, attempts = attempts + 1, history = $4, due_on = $5, updated_at = now(),
            -- com dificuldade: passa a entrar já nas próximas listas dos outros assuntos da disciplina (toda semana)
            next_review = case when hard or retained + 1 >= 2 then coalesce(next_review, $6::date) else next_review end
      where id = $1 and mentoria_id = $2`,
    [c.id, t.mentoria_id, Math.round((ok / Math.max(1, total)) * 100), JSON.stringify(history), shift(today, 1), today],
  );
  const next = await createTrailList(t.mentoria_id, c.id);
  return { trail: true, passed, ok, total, level: c.level, next: next?.listId ?? null, title: b.short, review: false };
}

/**
 * Mantém a trilha andando sozinha (roda quando o aluno ou o mentor abrem a mentoria):
 * - assunto em nível 1 a 3 sem lista aberta e na data → cria a lista;
 * - revisões atrasadas que nenhuma lista da disciplina levou → "Revisão da semana" da disciplina.
 */
export async function materialize(mentoriaId: string) {
  const today = todayBR();
  const missing = await sql.query<{ id: string }>(
    `select c.id from mentoria_cards c
      where c.mentoria_id = $1 and c.level between 1 and 3 and (c.due_on is null or c.due_on <= $2)
        and not exists (select 1 from mentoria_trail_lists t where t.card_id = c.id and t.status = 'open')
      order by c.due_on nulls first, c.ord limit 8`,
    [mentoriaId, today],
  );
  for (const m of missing) await createTrailList(mentoriaId, m.id);

  const late = await sql.query<TrailCard>(
    `select ${CARD_COLS} from mentoria_cards
      where mentoria_id = $1 and next_review is not null and next_review <= $2 and (level >= 4 or (hard and level >= 1))
      order by discipline, hard desc, next_review`,
    [mentoriaId, shift(today, -WEEKLY_AFTER)],
  );
  const byDisc = new Map<string, TrailCard[]>();
  for (const c of late) byDisc.set(c.discipline, [...(byDisc.get(c.discipline) ?? []), c]);
  for (const [disc, cs] of byDisc) {
    // já existe uma revisão da semana aberta desta disciplina: as questões entram na próxima
    if (await sql.one(`select 1 from mentoria_trail_lists where mentoria_id = $1 and level = 0 and discipline = $2 and status = 'open'`, [mentoriaId, disc]))
      continue;
    const review = await reviewQuestions(mentoriaId, cs, [], 10, today);
    if (!review.length) continue;
    const listId = await insertList(
      mentoriaId,
      `Revisão da semana · ${DISCIPLINE_NAME[disc] ?? disc}`,
      review.map((r) => r.q),
    );
    await sql.exec(
      `insert into mentoria_trail_lists (id, mentoria_id, card_id, item_key, discipline, level, round, list_id, main_ids, review)
       values ($1, $2, null, $3, $4, 0, 1, $5, '{}', $6)`,
      [newId(), mentoriaId, `revisao:${disc}`, disc, listId, JSON.stringify(review)],
    );
  }
}

/** Listas da trilha de uma mentoria (para a agenda, a trilha do aluno e o quadro do mentor). */
export const trailListsOf = (mentoriaId: string) =>
  sql.query<TrailList & { answered: number }>(
    `select t.*, t.created_at::text as created_at, t.finished_at::text as finished_at,
            (select count(distinct r.question_id)::int from list_responses r where r.list_id = t.list_id) as answered
       from mentoria_trail_lists t where t.mentoria_id = $1 order by t.created_at desc limit 400`,
    [mentoriaId],
  );

/** Quantas questões o banco tem de cada assunto, por nível (para o mentor ver onde falta questão). */
export const bankLevels = () =>
  sql.query<{ disciplina: string; assunto: string; lv: number; n: number }>(
    `select q.disciplina, q.assunto_geral as assunto, ${LEVEL_SQL} as lv, count(*)::int as n
       from questions q where q.status <> 'anulada' and q.disciplina <> '' and q.assunto_geral <> '' group by 1, 2, 3`,
  );
