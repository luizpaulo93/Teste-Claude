import 'server-only';
import { sql } from '@/lib/db';
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

/** Cards atrasados (ou ainda sem dia) passam para hoje em diante. */
export async function ensureFresh(mentoriaId: string) {
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
  const { ASSUNTOS, DISCIPLINES } = await import('@/lib/enem-matriz');
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
