import 'server-only';
import { newId, sql, tx } from '@/lib/db';
import { ASSUNTO_BY_KEY, ASSUNTOS } from '@/lib/enem-matriz';
import { COST, schedule, todayBR, type PlanCard } from '@/lib/mentoria';
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
}

export async function getMentoria(id: string) {
  const m = await sql.one<Mentoria & { plan_disciplines: string[]; plan_order: string }>(`select * from mentorias where id = $1`, [id]);
  if (!m) return null;
  return { ...m, availability: Array.isArray(m.availability) ? m.availability.map(Number) : [0, 0, 0, 0, 0, 0, 0], plan_disciplines: m.plan_disciplines ?? [] };
}

export const cards = (id: string) =>
  sql.query<Card>(
    `select id, item_key, discipline, title, priority, ord, level, step, due_on::text as due_on, scheduled_on::text as scheduled_on, last_acc, attempts,
            history -> -1 ->> 'd' as last_day
       from mentoria_cards where mentoria_id = $1 order by ord`,
    [id],
  );

/** Recalcula em que dia cai cada card, conforme os horários do aluno. */
export async function reschedule(mentoriaId: string) {
  const m = await sql.one<{ availability: number[] }>(`select availability from mentorias where id = $1`, [mentoriaId]);
  if (!m) return;
  const today = todayBR();
  const list = await sql.query<PlanCard & { last_day: string | null; last_level: number | null }>(
    `select id, level, step, ord, due_on::text as due_on, history -> -1 ->> 'd' as last_day, (history -> -1 ->> 'l')::int as last_level
       from mentoria_cards where mentoria_id = $1`,
    [mentoriaId],
  );
  const done = list.filter((c) => c.last_day === today && c.step === 'study');
  const plan = schedule(list, m.availability ?? [], today, 14, {
    minutes: done.reduce((a, c) => a + (c.last_level ? COST.revisao : COST.novo), 0),
    count: done.length,
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
  const queues = chosen.map((k) =>
    ASSUNTOS.filter((x) => x.discipline === k).sort((x, y) => (mode === 'prioridade' ? y.priority - x.priority : 0) || x.index - y.index),
  );
  const ordered: (typeof ASSUNTOS)[number][] = [];
  for (let i = 0; queues.some((q) => q.length > i); i++) for (const q of queues) if (q[i]) ordered.push(q[i]);
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
  const late = await sql.one(`select 1 from mentoria_cards where mentoria_id = $1 and level < 4 and (scheduled_on < $2 or scheduled_on is null) limit 1`, [
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
    };
  });
  return { rows, disciplines };
}
