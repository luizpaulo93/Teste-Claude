import 'server-only';
import { newId, sql, tx } from '@/lib/db';
import { ASSUNTO_BY_KEY, ASSUNTOS, trilhaKey } from '@/lib/trilha-catalog';
import { materialize } from '@/lib/trilha';
import { cleanWindows, COST, schedule, shift, todayBR, windowsFromAvailability, type PlanCard } from '@/lib/mentoria';
import type { Mentoria } from '@/lib/types';

export interface Card {
  id: string;
  item_key: string;
  discipline: string;
  title: string;
  priority: number;
  ord: number;
  level: number;
  step: 'study' | 'questions' | 'score';
  due_on: string | null;
  scheduled_on: string | null;
  last_acc: number | null;
  attempts: number;
  last_day: string | null;
  history: { d: string; q: number; c: number; l: number; f?: number; x?: number; r?: number; p?: number }[];
  pinned_on: string | null;
  added_by_student: boolean;
  /** período escolhido pelo mentor: de pinned_on até span_end */
  span_end: string | null;
  block_id: string | null;
  list_size: number;
  hard: boolean;
  retained: number;
  retained_total: number;
  next_review: string | null;
  mastered_on: string | null;
  /** atrasado desde (dia em que deveria ter sido feito) */
  late_from: string | null;
}

export async function getMentoria(id: string) {
  const m = await sql.one<Mentoria & { plan_disciplines: string[]; plan_order: string; group_id: string | null; scope: 'completa' | 'especifica'; study_windows: unknown }>(
    `select * from mentorias where id = $1`,
    [id],
  );
  if (!m) return null;
  const availability = Array.isArray(m.availability) ? m.availability.map(Number) : [0, 0, 0, 0, 0, 0, 0];
  // períodos de estudo de cada dia (quem ainda não escolheu: montados a partir dos minutos por dia)
  const windows = m.study_windows ? cleanWindows(m.study_windows) : windowsFromAvailability(availability);
  return { ...m, availability, windows, plan_disciplines: m.plan_disciplines ?? [] };
}

export const cards = (id: string) =>
  sql.query<Card>(
    `select id, item_key, discipline, title, priority, ord, level, step, due_on::text as due_on, scheduled_on::text as scheduled_on, last_acc, attempts,
            history -> -1 ->> 'd' as last_day, history, pinned_on::text as pinned_on, added_by_student, span_end::text as span_end, block_id,
            list_size, hard, retained, retained_total, next_review::text as next_review, mastered_on::text as mastered_on, late_from::text as late_from
       from mentoria_cards where mentoria_id = $1 order by ord`,
    [id],
  );

/** Fim do cronograma: fim da mentoria, ou data da prova, ou 6 meses. */
export function planEnd(m: { end_date: string | null; exam_date: string | null }, today: string) {
  return m.end_date || m.exam_date || shift(today, 180);
}

/** Recalcula em que dia cai cada assunto, do início ao fim da mentoria, nos horários do aluno. */
export async function reschedule(mentoriaId: string) {
  const m = await sql.one<{ availability: number[]; start_date: string; end_date: string | null; exam_date: string | null }>(
    `select availability, start_date::text as start_date, end_date::text as end_date, exam_date::text as exam_date from mentorias where id = $1`,
    [mentoriaId],
  );
  if (!m) return;
  const now = todayBR();
  const from = m.start_date && m.start_date > now ? m.start_date : now;
  // Ficou para trás (o dia passou e o assunto não foi feito): marca o dia em que atrasou.
  // Ele é realocado primeiro; a marca sai quando o aluno faz (teoria ou lista) — ver lib/trilha.ts.
  await sql.exec(
    `update mentoria_cards set late_from = scheduled_on
      where mentoria_id = $1 and late_from is null and scheduled_on < $2 and level < 4 and block_id is null`,
    [mentoriaId, now],
  );
  await sql.exec(`update mentoria_cards set late_from = null where mentoria_id = $1 and late_from is not null and level >= 4`, [mentoriaId]);
  const list = await sql.query<PlanCard & { last_day: string | null; last_level: number | null }>(
    `select id, level, step, ord, priority, late_from::text as late_from, due_on::text as due_on, pinned_on::text as pinned_on,
            history -> -1 ->> 'd' as last_day, (history -> -1 ->> 'l')::int as last_level
       from mentoria_cards where mentoria_id = $1`,
    [mentoriaId],
  );
  const done = list.filter((c) => c.last_day === now && c.step === 'study');
  const plan = schedule(list, m.availability ?? [], from, planEnd(m, now), {
    minutes: from === now ? done.reduce((a, c) => a + (c.last_level ? COST.revisao : COST.novo), 0) : 0,
    count: from === now ? done.length : 0,
  });
  const ids = [...plan.keys()];
  await sql.exec(
    `update mentoria_cards c set scheduled_on = v.d::date
       from unnest($2::text[], $3::text[]) as v(id, d)
      where c.mentoria_id = $1 and c.id = v.id and c.scheduled_on is distinct from v.d::date`,
    [mentoriaId, ids, ids.map((i) => plan.get(i) ?? null)],
  );
}

/** Ordem dos conteúdos: mais cobrados primeiro (faixas 3, 2, 1, alternando disciplinas) ou na ordem da lista. */
export function orderedKeys(chosen: string[], mode: 'prioridade' | 'matriz') {
  const tiers = mode === 'prioridade' ? [3, 2, 1] : [0];
  const ordered: string[] = [];
  for (const tier of tiers) {
    const queues = chosen.map((k) => ASSUNTOS.filter((x) => x.discipline === k && (tier === 0 || x.priority === tier)).sort((x, y) => x.index - y.index));
    for (let i = 0; queues.some((q) => q.length > i); i++) for (const q of queues) if (q[i]) ordered.push(q[i].key);
  }
  return ordered;
}

/** Deixa os cards da mentoria iguais à lista (na ordem dada). Progresso dos que ficam é mantido. */
export async function syncCards(mentoriaId: string, keys: string[]) {
  const list = keys.filter((k) => ASSUNTO_BY_KEY.has(k)).map((k) => ASSUNTO_BY_KEY.get(k)!);
  await tx(async (t) => {
    await t.exec(`delete from mentoria_cards where mentoria_id = $1 and not (item_key = any($2))`, [mentoriaId, list.map((x) => x.key)]);
    if (list.length)
      await t.exec(
        `insert into mentoria_cards (id, mentoria_id, item_key, discipline, title, priority, ord)
         select v.id, $1, v.k, v.d, v.t, v.p, v.o
           from unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::int[], $7::int[]) as v(id, k, d, t, p, o)
         on conflict (mentoria_id, item_key) do update set ord = excluded.ord, priority = excluded.priority, title = excluded.title, discipline = excluded.discipline`,
        [
          mentoriaId,
          list.map(() => newId()),
          list.map((x) => x.key),
          list.map((x) => x.discipline),
          list.map((x) => x.title),
          list.map((x) => x.priority),
          list.map((_, j) => j),
        ],
      );
  });
  return list.length;
}

/** Acrescenta assuntos no fim do cronograma do aluno (sem mexer no que ele já tem). */
export async function appendCards(mentoriaId: string, keys: string[]) {
  const list = keys.filter((k) => ASSUNTO_BY_KEY.has(k)).map((k) => ASSUNTO_BY_KEY.get(k)!);
  if (!list.length) return;
  const max = await sql.one<{ m: number }>(`select coalesce(max(ord), -1)::int as m from mentoria_cards where mentoria_id = $1`, [mentoriaId]);
  const start = (max?.m ?? -1) + 1;
  await sql.exec(
    `insert into mentoria_cards (id, mentoria_id, item_key, discipline, title, priority, ord)
     select v.id, $1, v.k, v.d, v.t, v.p, v.o from unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::int[], $7::int[]) as v(id, k, d, t, p, o)
     on conflict (mentoria_id, item_key) do nothing`,
    [
      mentoriaId,
      list.map(() => newId()),
      list.map((x) => x.key),
      list.map((x) => x.discipline),
      list.map((x) => x.title),
      list.map((x) => x.priority),
      list.map((_, j) => start + j),
    ],
  );
}

/** Plano automático: todos os conteúdos das disciplinas escolhidas, na ordem escolhida. */
export async function writePlan(mentoriaId: string, chosen: string[], mode: 'prioridade' | 'matriz') {
  const n = await syncCards(mentoriaId, orderedKeys(chosen, mode));
  await sql.exec(`update mentorias set plan_disciplines = $2, plan_order = $3, updated_at = now() where id = $1`, [mentoriaId, chosen, mode]);
  return n;
}

/**
 * Cronograma antigo (conteúdos da matriz do ENEM) → trilha (assuntos do banco de questões).
 * Cada conteúdo vai para o seu assunto; vários conteúdos no mesmo assunto viram um só, com o maior nível,
 * as tentativas somadas e o histórico junto. Os períodos (blocos) do mentor também passam para a trilha.
 */
async function convertLegacy(mentoriaId: string) {
  type Row = {
    id: string; item_key: string; level: number; attempts: number; history: unknown[]; last_acc: number | null; ord: number;
    due_on: string | null; pinned_on: string | null; span_end: string | null; block_id: string | null; added_by_student: boolean; from_block: boolean;
  };
  const rows = await sql.query<Row>(
    `select id, item_key, level, attempts, history, last_acc, ord, due_on::text as due_on, pinned_on::text as pinned_on, span_end::text as span_end,
            block_id, added_by_student, from_block from mentoria_cards where mentoria_id = $1`,
    [mentoriaId],
  );
  const old = rows.filter((r) => !ASSUNTO_BY_KEY.has(r.item_key));
  if (!old.length) return false;
  const merged = new Map<string, Row>();
  for (const r of [...rows.filter((x) => ASSUNTO_BY_KEY.has(x.item_key)), ...old]) {
    const k = trilhaKey(r.item_key);
    if (!k) continue;
    const o = merged.get(k);
    if (!o) {
      merged.set(k, { ...r, item_key: k, history: Array.isArray(r.history) ? r.history : [] });
      continue;
    }
    merged.set(k, {
      ...o,
      level: Math.max(o.level, r.level),
      last_acc: r.level > o.level ? r.last_acc : o.last_acc,
      attempts: o.attempts + r.attempts,
      ord: Math.min(o.ord, r.ord),
      history: [...o.history, ...(Array.isArray(r.history) ? r.history : [])],
      due_on: [o.due_on, r.due_on].filter(Boolean).sort()[0] ?? null,
      pinned_on: o.pinned_on ?? r.pinned_on,
      span_end: o.span_end ?? r.span_end,
      block_id: o.block_id ?? r.block_id,
      added_by_student: o.added_by_student && r.added_by_student,
      from_block: o.from_block || r.from_block,
    });
  }
  const list = [...merged.values()].map((r) => {
    const a = ASSUNTO_BY_KEY.get(r.item_key)!;
    const history = (r.history as { d?: string }[]).sort((x, y) => String(x.d).localeCompare(String(y.d))).slice(-40);
    return { ...r, a, history };
  });
  await tx(async (t) => {
    await t.exec(`delete from mentoria_cards where mentoria_id = $1`, [mentoriaId]);
    if (list.length)
      await t.exec(
        `insert into mentoria_cards (id, mentoria_id, item_key, discipline, title, priority, ord, level, attempts, history, last_acc, due_on,
                                     pinned_on, span_end, block_id, added_by_student, from_block)
         select v.id, $1, v.k, v.d, v.t, v.p, v.o, v.l, v.n, v.h::jsonb, v.acc, v.due::date, v.pin::date, v.span::date, v.blk, v.st, v.fb
           from unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::int[], $7::int[], $8::int[], $9::int[], $10::text[], $11::int[],
                       $12::text[], $13::text[], $14::text[], $15::text[], $16::bool[], $17::bool[])
             as v(id, k, d, t, p, o, l, n, h, acc, due, pin, span, blk, st, fb)`,
        [
          mentoriaId,
          list.map(() => newId()),
          list.map((x) => x.item_key),
          list.map((x) => x.a.discipline),
          list.map((x) => x.a.title),
          list.map((x) => x.a.priority),
          list.map((x) => x.ord),
          list.map((x) => Math.min(4, x.level)),
          list.map((x) => x.attempts),
          list.map((x) => JSON.stringify(x.history)),
          list.map((x) => x.last_acc),
          list.map((x) => x.due_on),
          list.map((x) => x.pinned_on),
          list.map((x) => x.span_end),
          list.map((x) => x.block_id),
          list.map((x) => x.added_by_student),
          list.map((x) => x.from_block),
        ],
      );
  });
  // os períodos do mentor (desta mentoria e do grupo) também passam para os assuntos da trilha
  const spaces = await sql.query<{ id: string; item_keys: string[] }>(
    `select b.id, b.item_keys from mentoria_blocks b
      where b.space = $1 or b.space = (select 'g:' || group_id from mentorias where id = $2 and group_id is not null)`,
    [`m:${mentoriaId}`, mentoriaId],
  );
  for (const b of spaces) {
    const keys = [...new Set(b.item_keys.map((k) => trilhaKey(k)).filter((k): k is string => Boolean(k)))];
    if (keys.join() !== b.item_keys.join()) await sql.exec(`update mentoria_blocks set item_keys = $2 where id = $1`, [b.id, keys]);
  }
  return true;
}

/**
 * Deixa a mentoria em dia sempre que alguém a abre: converte o cronograma antigo, completa o plano
 * automático, passa para hoje o que ficou atrasado e cria as listas da trilha que já estão na data.
 */
export async function ensureFresh(mentoriaId: string) {
  const converted = await convertLegacy(mentoriaId);
  if (converted) {
    const m = await sql.one<{ plan_disciplines: string[]; plan_order: string; scope: string }>(
      `select plan_disciplines, plan_order, scope from mentorias where id = $1`,
      [mentoriaId],
    );
    // plano automático: entram os assuntos da trilha que não tinham par no cronograma antigo
    if (m?.plan_disciplines?.length && m.scope !== 'especifica') await writePlan(mentoriaId, m.plan_disciplines, m.plan_order === 'matriz' ? 'matriz' : 'prioridade');
    await reschedule(mentoriaId);
  } else {
    const late = await sql.one(`select 1 from mentoria_cards where mentoria_id = $1 and (scheduled_on < $2) limit 1`, [mentoriaId, todayBR()]);
    if (late) await reschedule(mentoriaId);
  }
  await materialize(mentoriaId);
}

export const nextMeeting = async (id: string) =>
  sql.one<{ title: string; starts_at: string; link: string }>(
    `select title, starts_at, link from mentoria_meetings where (mentoria_id = $1 or mentoria_id is null) and starts_at >= $2 order by starts_at limit 1`,
    [id, new Date(Date.now() - 2 * 3600_000).toISOString()],
  );

/**
 * Assuntos com a situação do aluno em cada um.
 * Mentoria completa: todos os assuntos de todas as disciplinas. Específica: só os que o mentor escolheu.
 */
export async function assuntoRows(id: string, list?: Card[], scope: 'completa' | 'especifica' = 'completa') {
  const { DISCIPLINES } = await import('@/lib/trilha-catalog');
  const cs = list ?? (await cards(id));
  const by = new Map(cs.map((c) => [c.item_key, c]));
  const specific = scope === 'especifica';
  const inPlan = new Set(cs.map((c) => c.discipline));
  const disciplines = DISCIPLINES.filter((d) => !specific || inPlan.has(d.key)).map((d) => ({ key: d.key, name: d.name }));
  const { trailListsOf } = await import('@/lib/trilha');
  const lists = await trailListsOf(id);
  const open = new Map<string, { id: string; answered: number; total: number; round: number }>();
  for (const t of lists)
    if (t.status === 'open' && t.card_id && !open.has(t.card_id))
      open.set(t.card_id, { id: t.list_id, answered: t.answered, total: t.main_ids.length + t.review.length, round: t.round });
  const rows = ASSUNTOS.filter((a) => (specific ? by.has(a.key) : true)).map((a) => {
    const c = by.get(a.key);
    return {
      key: a.key,
      discipline: a.discipline,
      block: a.block,
      title: a.title,
      short: a.short,
      priority: a.priority,
      level: c ? c.level : null,
      last_acc: c?.last_acc ?? null,
      due_on: c?.due_on ?? null,
      attempts: c?.attempts ?? 0,
      scheduled: c?.scheduled_on ?? null,
      extra: c?.pinned_on ?? null,
      byStudent: c?.added_by_student ?? false,
      cardId: c?.id ?? null,
      hard: c?.hard ?? false,
      retained: c?.retained ?? 0,
      size: c?.list_size ?? 5,
      nextReview: c?.next_review ?? null,
      list: c ? (open.get(c.id) ?? null) : null,
    };
  });
  return { rows, disciplines };
}

/** Atrasados primeiro (e, entre eles, os mais cobrados no ENEM); o resto mantém a ordem do plano */
const lateFirst = (a: { late: string | null; priority: number }, b: { late: string | null; priority: number }) =>
  a.late && b.late ? b.priority - a.priority || a.late.localeCompare(b.late) : Number(Boolean(b.late)) - Number(Boolean(a.late));

/** Lista da trilha mostrada na agenda (a que o aluno abre para responder) */
export interface DayList {
  id: string;
  answered: number;
  total: number;
  round: number;
}

/** Dados de um dia do cronograma (passado: o que foi feito; hoje: a fazer + feitos; futuro: planejado). */
export async function dayData(m: { id: string; availability: number[] }, requested?: string) {
  const { DISCIPLINE_NAME: names } = await import('@/lib/trilha-catalog');
  const { weekdayIndex } = await import('@/lib/mentoria');
  const { passedList, trailListsOf } = await import('@/lib/trilha');
  const today = todayBR();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(requested ?? '') ? requested! : today;
  const monday = shift(day, -weekdayIndex(day));
  const week = Array.from({ length: 7 }, (_, i) => shift(monday, i));
  const [list, lists] = await Promise.all([cards(m.id), trailListsOf(m.id)]);
  const open = new Map<string, DayList>();
  for (const t of lists)
    if (t.status === 'open' && t.card_id && !open.has(t.card_id))
      open.set(t.card_id, { id: t.list_id, answered: t.answered, total: t.main_ids.length + t.review.length, round: t.round });
  const base = (c: Card) => {
    const a = ASSUNTO_BY_KEY.get(c.item_key);
    return {
      id: c.id,
      kind: (c.level === 0 ? 'theory' : 'list') as 'theory' | 'list' | 'review',
      discipline: names[c.discipline] ?? c.discipline,
      title: a?.short ?? c.title,
      priority: c.priority,
      size: c.list_size,
      hard: c.hard,
      retained: c.retained,
      extra: false,
      period: null as { from: string; to: string } | null,
      list: null as DayList | null,
    };
  };
  const done = list.flatMap((c) =>
    (c.history ?? [])
      .filter((h) => h.d === day)
      .map((h, k) => {
        const acc = h.q ? Math.round((h.c / h.q) * 100) : 0;
        // listas da trilha guardam se passou; registros antigos usam mais da metade
        const passed = h.p === undefined ? passedList(h.c, h.q) : Boolean(h.p);
        return {
          ...base(c),
          extra: Boolean(h.x),
          id: `${c.id}-${h.l}-${k}`,
          level: h.l,
          step: 'study' as const,
          result: { q: h.q, c: h.c, acc, passed, round: h.r ?? 1 },
        };
      }),
  );
  // Assunto num período (mentor): aparece em todos os dias do período; atrasado, aparece hoje
  const inSpan = (c: Card) => Boolean(c.pinned_on && c.span_end && c.block_id);
  const coversDay = (c: Card) => c.pinned_on! <= day && (c.span_end! >= day || (day === today && c.span_end! < today));
  const pending =
    day < today
      ? []
      : list
          .filter((c) => c.level < 4)
          .filter((c) => (inSpan(c) ? coversDay(c) : day === today ? c.scheduled_on !== null && c.scheduled_on <= today : c.scheduled_on === day))
          .filter((c) => !(c.last_day === today && day === today && !open.has(c.id)))
          .map((c) => ({
            ...base(c),
            extra: Boolean(c.pinned_on) && !c.block_id,
            period: inSpan(c) && c.span_end !== c.pinned_on ? { from: c.pinned_on!, to: c.span_end! } : null,
            level: c.level,
            step: 'study' as const,
            list: open.get(c.id) ?? null,
            result: null,
            late: c.late_from,
          }))
          // o que atrasou vem primeiro (entre os atrasados, os mais cobrados no ENEM); o resto na ordem do plano
          .sort(lateFirst);
  // revisões da semana abertas (assuntos estudados que voltam): aparecem hoje
  const reviews =
    day === today
      ? lists
          .filter((t) => t.status === 'open' && t.level === 0)
          .map((t) => ({
            id: `rev-${t.id}`,
            kind: 'review' as const,
            discipline: names[t.discipline] ?? t.discipline,
            title: 'Revisão da semana',
            priority: 1,
            size: t.review.length,
            hard: false,
            retained: 0,
            extra: false,
            period: null,
            level: 0,
            step: 'study' as const,
            list: { id: t.list_id, answered: t.answered, total: t.review.length, round: 1 },
            result: null,
          }))
      : [];
  const items = [...reviews, ...pending, ...done];
  // Assuntos de período não contam no tempo do dia (o aluno distribui dentro do período)
  const minutes = items.filter((i) => !i.period && !i.result).reduce((a, i) => a + (i.kind === 'theory' ? COST.novo : COST.revisao), 0);
  return { today, day, week, items, minutes, free: Number(m.availability[weekdayIndex(day)]) || 0 };
}

/** Um assunto no quadro do mentor */
export interface BoardCard {
  id: string;
  key: string;
  discipline: string;
  block: string;
  title: string;
  priority: number;
  level: number;
  ord: number;
  scheduled: string | null;
  hard: boolean;
  retained: number;
  retainedTotal: number;
  size: number;
  nextReview: string | null;
  masteredOn: string | null;
  /** lista aberta agora */
  list: { id: string; answered: number; total: number; round: number; off: number; since: string } | null;
  /** listas já feitas (mais recentes primeiro) */
  done: { id: string; level: number; round: number; ok: number; total: number; status: string; at: string }[];
  /** questões do banco deste assunto em cada nível: [sem classificação, 1, 2, 3] */
  bank: [number, number, number, number];
}

/** Quadro do mentor: cada assunto com a etapa, a lista aberta, o histórico e o que o banco tem. */
export async function boardData(mentoriaId: string) {
  const { trailListsOf, bankLevels } = await import('@/lib/trilha');
  const { DISCIPLINE_NAME } = await import('@/lib/trilha-catalog');
  const [list, lists, bank] = await Promise.all([cards(mentoriaId), trailListsOf(mentoriaId), bankLevels()]);
  const bankBy = new Map<string, [number, number, number, number]>();
  for (const b of bank) {
    const k = `${b.disciplina}|${b.assunto}`;
    const v = bankBy.get(k) ?? [0, 0, 0, 0];
    v[Math.max(0, Math.min(3, b.lv))] += b.n;
    bankBy.set(k, v);
  }
  const byCard = new Map<string, typeof lists>();
  for (const t of lists) if (t.card_id) byCard.set(t.card_id, [...(byCard.get(t.card_id) ?? []), t]);
  const out: BoardCard[] = list.map((c) => {
    const a = ASSUNTO_BY_KEY.get(c.item_key);
    const mine = byCard.get(c.id) ?? [];
    const open = mine.find((t) => t.status === 'open');
    return {
      id: c.id,
      key: c.item_key,
      discipline: c.discipline,
      block: a?.block ?? '',
      title: a?.short ?? c.title,
      priority: c.priority,
      level: Math.min(4, c.level),
      ord: c.ord,
      scheduled: c.scheduled_on,
      hard: c.hard,
      retained: c.retained,
      retainedTotal: c.retained_total,
      size: c.list_size,
      nextReview: c.next_review,
      masteredOn: c.mastered_on,
      list: open
        ? { id: open.list_id, answered: open.answered, total: open.main_ids.length + open.review.length, round: open.round, off: open.off_level, since: open.created_at.slice(0, 10) }
        : null,
      done: mine
        .filter((t) => t.status !== 'open')
        .map((t) => ({ id: t.list_id, level: t.level, round: t.round, ok: t.ok ?? 0, total: t.total ?? 0, status: t.status, at: (t.finished_at ?? t.created_at).slice(0, 10) })),
      bank: bankBy.get(`${DISCIPLINE_NAME[c.discipline] ?? c.discipline}|${a?.title ?? c.title}`) ?? [0, 0, 0, 0],
    };
  });
  const weekly = lists.filter((t) => t.level === 0).slice(0, 6).map((t) => ({ id: t.list_id, discipline: DISCIPLINE_NAME[t.discipline] ?? t.discipline, status: t.status, at: t.created_at.slice(0, 10), q: t.review.length, ok: t.ok, total: t.total }));
  return { cards: out, weekly };
}

/** Painel do aluno: números, revisão, todos os assuntos com a fase e as listas da mentoria. */
export async function studentPanel(m: { id: string; plan_disciplines: string[]; availability: number[] }) {
  const { DISCIPLINES } = await import('@/lib/trilha-catalog');
  const today = todayBR();
  const [list, lists, acc, due, todayData] = await Promise.all([
    cards(m.id),
    sql.query<{ id: string; title: string; level: number; status: string; ok: number | null; total: number | null; created_at: string; n: number; answered: number }>(
      `select t.list_id as id, l.title, t.level, t.status, t.ok, t.total, t.created_at::text as created_at, cardinality(l.question_ids)::int as n,
              (select count(distinct r.question_id)::int from list_responses r where r.list_id = t.list_id) as answered
         from mentoria_trail_lists t join question_lists l on l.id = t.list_id
        where t.mentoria_id = $1 order by t.created_at desc limit 300`,
      [m.id],
    ),
    sql.one<{ n: number; ok: number; week: number }>(
      `select count(*)::int as n, count(*) filter (where r.correct)::int as ok,
              count(*) filter (where r.answered_at > now() - interval '7 days')::int as week
         from list_responses r join mentoria_trail_lists t on t.list_id = r.list_id where t.mentoria_id = $1`,
      [m.id],
    ),
    sql.one<{ q: number; a: number }>(
      `select (select count(*)::int from mentoria_qmemory where mentoria_id = $1 and box <= 2 and due <= $2) as q,
              (select count(*)::int from mentoria_cards where mentoria_id = $1 and level >= 1 and next_review <= $2) as a`,
      [m.id, today],
    ),
    dayData(m),
  ]);
  const by = new Map(list.map((c) => [c.item_key, c]));
  const inPlan = new Set(list.map((c) => c.discipline));
  const discs = DISCIPLINES.filter((d) => inPlan.has(d.key) || m.plan_disciplines.includes(d.key));
  const subjects = (discs.length ? discs : DISCIPLINES).flatMap((d) =>
    d.blocks.flatMap((b) =>
      b.items.map((i) => {
        const c = by.get(i.key);
        return {
          key: i.key,
          discipline: d.key,
          block: b.title,
          title: i.title.includes(':') ? i.title.split(':').slice(1).join(':').trim() : i.title,
          priority: i.priority,
          // -1 fora da trilha; 0 teoria; 1 a 3 níveis; 4 dominado
          phase: c ? Math.min(4, c.level) : -1,
          hard: c?.hard ?? false,
          scheduled: c?.scheduled_on ?? null,
        };
      }),
    ),
  );
  return {
    disciplines: (discs.length ? discs : DISCIPLINES).map((d) => ({ key: d.key, name: d.name })),
    subjects,
    // finalizada pelo aluno (fechada pelo mentor sem o aluno terminar não libera as resoluções)
    lists: lists.map((l) => ({ ...l, finished: ['passed', 'failed', 'done'].includes(l.status) })),
    stats: {
      total: list.length,
      mastered: list.filter((c) => c.level >= 4).length,
      doing: list.filter((c) => c.level >= 1 && c.level <= 3).length,
      hard: list.filter((c) => c.hard).length,
      answered: acc?.n ?? 0,
      accuracy: acc?.n ? Math.round(((acc.ok ?? 0) / acc.n) * 100) : null,
      week: acc?.week ?? 0,
      reviewQuestions: due?.q ?? 0,
      reviewSubjects: due?.a ?? 0,
      todayTasks: todayData.items.filter((i) => !i.result).length,
      finishedLists: lists.filter((l) => l.status !== 'open').length,
    },
  };
}

/** Uma sessão na grade da semana */
export interface WeekSession {
  id: string;
  kind: 'theory' | 'list' | 'review';
  discipline: string;
  disciplineName: string;
  title: string;
  minutes: number;
  level: number;
  priority: number;
  /** horário de início (pelos períodos do aluno) */
  start: string;
  /** já feita neste dia (resultado) */
  done: { passed: boolean; acc: number } | null;
  /** atrasada: dia em que deveria ter sido feita */
  late: string | null;
  /** dia passado em que não foi feita: foi realocada para esta data */
  movedTo: string | null;
  /** assunto de período do mentor (não ocupa tempo do dia) */
  period: boolean;
}

/**
 * Semana do aluno (seg a dom): o que foi feito nos dias que passaram, o que ficou para trás (e para onde foi)
 * e o planejado de hoje em diante — atrasados primeiro, mais cobrados no ENEM na frente.
 */
export async function weekData(m: { id: string; availability: number[]; windows: import('@/lib/mentoria').StudyWindow[][] }, requested?: string) {
  const { DISCIPLINE_NAME: names } = await import('@/lib/trilha-catalog');
  const { weekdayIndex, sessionStarts } = await import('@/lib/mentoria');
  const { passedList, trailListsOf } = await import('@/lib/trilha');
  const today = todayBR();
  const ref = /^\d{4}-\d{2}-\d{2}$/.test(requested ?? '') ? requested! : today;
  const monday = shift(ref, -weekdayIndex(ref));
  const week = Array.from({ length: 7 }, (_, i) => shift(monday, i));
  const [list, lists, late] = await Promise.all([
    cards(m.id),
    trailListsOf(m.id),
    sql.query<{ id: string; late_from: string }>(`select id, late_from::text as late_from from mentoria_cards where mentoria_id = $1 and late_from is not null`, [m.id]),
  ]);
  const lateOf = new Map(late.map((l) => [l.id, l.late_from]));
  const open = new Set(lists.filter((t) => t.status === 'open' && t.card_id).map((t) => t.card_id!));
  const base = (c: Card) => {
    const a = ASSUNTO_BY_KEY.get(c.item_key);
    return {
      discipline: c.discipline,
      disciplineName: names[c.discipline] ?? c.discipline,
      title: a?.short ?? c.title,
      priority: c.priority,
      level: c.level,
    };
  };
  const inSpan = (c: Card) => Boolean(c.pinned_on && c.span_end && c.block_id);

  const days = week.map((d) => {
    const done: WeekSession[] = list.flatMap((c) =>
      (c.history ?? [])
        .filter((h) => h.d === d)
        .map((h, k) => ({
          ...base(c),
          id: `${c.id}-h${k}`,
          kind: 'list' as const,
          level: h.l,
          minutes: COST.revisao,
          start: '',
          done: { passed: h.p === undefined ? passedList(h.c, h.q) : Boolean(h.p), acc: h.q ? Math.round((h.c / h.q) * 100) : 0 },
          late: null,
          movedTo: null,
          period: false,
        })),
    );
    // dia que passou: o que era dele e ficou para trás (já realocado)
    const missed: WeekSession[] =
      d < today
        ? list
            .filter((c) => lateOf.get(c.id) === d)
            .map((c) => ({
              ...base(c),
              id: `${c.id}-miss`,
              kind: (c.level === 0 ? 'theory' : 'list') as 'theory' | 'list',
              minutes: c.level === 0 ? COST.novo : COST.revisao,
              start: '',
              done: null,
              late: d,
              movedTo: c.scheduled_on,
              period: false,
            }))
        : [];
    const pending: WeekSession[] =
      d < today
        ? []
        : list
            .filter((c) => c.level < 4)
            .filter((c) =>
              inSpan(c)
                ? c.pinned_on! <= d && (c.span_end! >= d || (d === today && c.span_end! < today))
                : d === today
                  ? c.scheduled_on !== null && c.scheduled_on <= today
                  : c.scheduled_on === d,
            )
            .filter((c) => !(c.last_day === today && d === today && !open.has(c.id)))
            .map((c) => ({
              ...base(c),
              id: c.id,
              kind: (c.level === 0 ? 'theory' : 'list') as 'theory' | 'list',
              minutes: inSpan(c) ? 0 : c.level === 0 ? COST.novo : COST.revisao,
              start: '',
              done: null,
              late: lateOf.get(c.id) ?? null,
              movedTo: null,
              period: inSpan(c),
            }))
            // atrasados na frente (os mais cobrados no ENEM primeiro); o resto na ordem do plano
            .sort(lateFirst);
    const reviews: WeekSession[] =
      d === today
        ? lists
            .filter((t) => t.status === 'open' && t.level === 0)
            .map((t) => ({
              id: `rev-${t.id}`,
              kind: 'review' as const,
              discipline: t.discipline,
              disciplineName: names[t.discipline] ?? t.discipline,
              title: 'Revisão da semana',
              priority: 1,
              level: 0,
              minutes: COST.revisao,
              start: '',
              done: null,
              late: null,
              movedTo: null,
              period: false,
            }))
        : [];
    const todo = [...pending.filter((s) => s.late), ...reviews, ...pending.filter((s) => !s.late)];
    const timed = todo.filter((s) => !s.period);
    const starts = sessionStarts(m.windows[weekdayIndex(d)] ?? [], timed.map((s) => s.minutes));
    timed.forEach((s, i) => (s.start = starts[i] ?? ''));
    const sessions = [...done, ...missed, ...todo];
    return { date: d, free: Number(m.availability[weekdayIndex(d)]) || 0, sessions, lateDay: missed.length > 0 };
  });

  const real = days.flatMap((x) => x.sessions).filter((s) => !s.movedTo && !s.period);
  const summary = {
    planned: real.reduce((a, s) => a + s.minutes, 0),
    free: m.availability.reduce((a, b) => a + (Number(b) || 0), 0),
    sessions: real.length,
    disciplines: new Set(real.map((s) => s.discipline)).size,
    reviews: real.filter((s) => s.kind !== 'theory').reduce((a, s) => a + s.minutes, 0),
    done: real.filter((s) => s.done).length,
    late: late.length,
  };
  return { today, monday, week, days, summary };
}
