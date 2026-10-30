import 'server-only';
import { newId, sql, tx } from '@/lib/db';
import { ASSUNTO_BY_KEY, ASSUNTOS } from '@/lib/enem-matriz';
import { COST, schedule, shift, todayBR, type PlanCard } from '@/lib/mentoria';
import type { Mentoria, MentoriaMessage } from '@/lib/types';

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
  history: { d: string; q: number; c: number; l: number }[];
}

export async function getMentoria(id: string) {
  const m = await sql.one<Mentoria & { plan_disciplines: string[]; plan_order: string }>(`select * from mentorias where id = $1`, [id]);
  if (!m) return null;
  return { ...m, availability: Array.isArray(m.availability) ? m.availability.map(Number) : [0, 0, 0, 0, 0, 0, 0], plan_disciplines: m.plan_disciplines ?? [] };
}

export const cards = (id: string) =>
  sql.query<Card>(
    `select id, item_key, discipline, title, priority, ord, level, step, due_on::text as due_on, scheduled_on::text as scheduled_on, last_acc, attempts,
            history -> -1 ->> 'd' as last_day, history
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
  const list = await sql.query<PlanCard & { last_day: string | null; last_level: number | null }>(
    `select id, level, step, ord, due_on::text as due_on, history -> -1 ->> 'd' as last_day, (history -> -1 ->> 'l')::int as last_level
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

/**
 * Grava o plano: cada conteúdo das disciplinas escolhidas vira um card (mais cobrados primeiro ou na ordem da lista),
 * intercalando as disciplinas. Conteúdos que saíram da lista são removidos.
 */
export async function writePlan(mentoriaId: string, chosen: string[], mode: 'prioridade' | 'matriz') {
  // Mais cobrados primeiro: por faixa de prioridade (3, 2, 1), alternando as disciplinas dentro de cada faixa.
  // "Do primeiro ao último": só alterna as disciplinas na ordem da lista.
  const tiers = mode === 'prioridade' ? [3, 2, 1] : [0];
  const ordered: (typeof ASSUNTOS)[number][] = [];
  for (const tier of tiers) {
    const queues = chosen.map((k) => ASSUNTOS.filter((x) => x.discipline === k && (tier === 0 || x.priority === tier)).sort((x, y) => x.index - y.index));
    for (let i = 0; queues.some((q) => q.length > i); i++) for (const q of queues) if (q[i]) ordered.push(q[i]);
  }
  await tx(async (t) => {
    await t.exec(`delete from mentoria_cards where mentoria_id = $1 and not (item_key = any($2))`, [mentoriaId, ASSUNTOS.map((x) => x.key)]);
    // Disciplina tirada: some só o que ainda não foi estudado
    await t.exec(`delete from mentoria_cards where mentoria_id = $1 and level = 0 and step = 'study' and not (discipline = any($2))`, [mentoriaId, chosen]);
    if (ordered.length)
      await t.exec(
        `insert into mentoria_cards (id, mentoria_id, item_key, discipline, title, priority, ord)
         select v.id, $1, v.k, v.d, v.t, v.p, v.o
           from unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::int[], $7::int[]) as v(id, k, d, t, p, o)
         on conflict (mentoria_id, item_key) do update set ord = excluded.ord, priority = excluded.priority, title = excluded.title, discipline = excluded.discipline`,
        [
          mentoriaId,
          ordered.map(() => newId()),
          ordered.map((x) => x.key),
          ordered.map((x) => x.discipline),
          ordered.map((x) => x.title),
          ordered.map((x) => x.priority),
          ordered.map((_, j) => j),
        ],
      );
    await t.exec(`update mentorias set plan_disciplines = $2, plan_order = $3, updated_at = now() where id = $1`, [mentoriaId, chosen, mode]);
  });
  return ordered.length;
}

/** Cards atrasados (ou ainda sem dia) passam para hoje em diante; plano antigo é trocado pelos conteúdos atuais. */
export async function ensureFresh(mentoriaId: string) {
  const keys = await sql.query<{ item_key: string }>(`select distinct item_key from mentoria_cards where mentoria_id = $1`, [mentoriaId]);
  if (keys.some((k) => !ASSUNTO_BY_KEY.has(k.item_key))) {
    const m = await sql.one<{ plan_disciplines: string[]; plan_order: string }>(`select plan_disciplines, plan_order from mentorias where id = $1`, [mentoriaId]);
    if (m?.plan_disciplines?.length) {
      await writePlan(mentoriaId, m.plan_disciplines, m.plan_order === 'matriz' ? 'matriz' : 'prioridade');
      await reschedule(mentoriaId);
      return;
    }
  }
  const late = await sql.one(`select 1 from mentoria_cards where mentoria_id = $1 and (scheduled_on < $2) limit 1`, [
    mentoriaId,
    todayBR(),
  ]);
  if (late) await reschedule(mentoriaId);
}

export const messages = (id: string) =>
  sql.query<MentoriaMessage>(`select * from (select * from mentoria_messages where mentoria_id = $1 order by created_at desc limit 150) x order by created_at`, [id]);

export const unreadCount = async (id: string, forMentor: boolean) =>
  (await sql.one<{ n: number }>(`select count(*)::int as n from mentoria_messages where mentoria_id = $1 and from_mentor = $2 and read_at is null`, [id, !forMentor]))?.n ?? 0;

export const nextMeeting = async (id: string) =>
  sql.one<{ title: string; starts_at: string; link: string }>(
    `select title, starts_at, link from mentoria_meetings where (mentoria_id = $1 or mentoria_id is null) and starts_at >= $2 order by starts_at limit 1`,
    [id, new Date(Date.now() - 2 * 3600_000).toISOString()],
  );

/** Todos os assuntos das disciplinas (plano + matriz) com a situação do aluno em cada um. */
export async function assuntoRows(id: string, list?: Card[]) {
  const { DISCIPLINES } = await import('@/lib/enem-matriz');
  const cs = list ?? (await cards(id));
  const by = new Map(cs.map((c) => [c.item_key, c]));
  const inPlan = new Set(cs.map((c) => c.discipline));
  const disciplines = DISCIPLINES.filter((d) => inPlan.has(d.key)).map((d) => ({ key: d.key, name: d.name }));
  const rows = ASSUNTOS.filter((a) => inPlan.has(a.discipline)).map((a) => {
    const c = by.get(a.key);
    return {
      key: a.key,
      discipline: a.discipline,
      block: a.block,
      title: a.title,
      priority: a.priority,
      level: c ? c.level : null,
      last_acc: c?.last_acc ?? null,
      due_on: c?.due_on ?? null,
      attempts: c?.attempts ?? 0,
      scheduled: c?.scheduled_on ?? null,
    };
  });
  return { rows, disciplines };
}

/** Dados de um dia do cronograma (passado: o que foi estudado; hoje: a fazer + feitos; futuro: planejado). */
export async function dayData(m: { id: string; availability: number[] }, requested?: string) {
  const { ASSUNTO_BY_KEY: byKey, DISCIPLINES: discs } = await import('@/lib/enem-matriz');
  const { GOAL, weekdayIndex } = await import('@/lib/mentoria');
  const names = Object.fromEntries(discs.map((d) => [d.key, d.name]));
  const today = todayBR();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(requested ?? '') ? requested! : today;
  const monday = shift(day, -weekdayIndex(day));
  const week = Array.from({ length: 7 }, (_, i) => shift(monday, i));
  const list = await cards(m.id);
  const base = (c: Card) => ({ id: c.id, discipline: names[c.discipline] ?? c.discipline, title: byKey.get(c.item_key)?.title ?? c.title, priority: c.priority });
  const done = list.flatMap((c) =>
    (c.history ?? [])
      .filter((h) => h.d === day)
      .map((h) => {
        const acc = h.q ? Math.round((h.c / h.q) * 100) : 0;
        const goal = h.l ? GOAL[Math.min(4, h.l)] : 0;
        return { ...base(c), id: `${c.id}-${h.l}`, level: h.l, step: 'study' as const, result: { q: h.q, c: h.c, acc, goal, passed: acc >= goal } };
      }),
  );
  const pending =
    day < today
      ? []
      : list
          .filter((c) => (day === today ? c.scheduled_on !== null && c.scheduled_on <= today : c.scheduled_on === day) && !(c.last_day === today && day === today && c.step === 'study'))
          .map((c) => ({ ...base(c), level: c.level, step: c.step === 'questions' ? ('questions' as const) : ('study' as const), result: null }));
  const items = [...pending, ...done];
  const minutes = items.reduce((a, i) => a + (i.level ? COST.revisao : COST.novo), 0);
  return { today, day, week, items, minutes, free: Number(m.availability[weekdayIndex(day)]) || 0 };
}
