import 'server-only';
import { sql } from '@/lib/db';
import { shift, todayBR } from '@/lib/mentoria';
import { ASSUNTO_BY_KEY, DISCIPLINE_NAME } from '@/lib/trilha-catalog';

/**
 * Painel do mentor: tudo de cada mentorado num período (7 ou 30 dias) comparado ao período anterior
 * do mesmo tamanho. Questões = respostas nas listas + questões do banco respondidas fora das listas.
 */
export interface PanelStudent {
  id: string;
  name: string;
  email: string;
  group: string;
  status: string;
  /** último dia com alguma resposta ou lista */
  lastActive: string | null;
  idleDays: number | null;
  answered: number;
  correct: number;
  accuracy: number | null;
  /** período anterior */
  answeredBefore: number;
  accuracyBefore: number | null;
  /** variação do acerto (pontos percentuais); null sem dados suficientes nos dois períodos */
  delta: number | null;
  activeDays: number;
  listsDone: number;
  listsPassed: number;
  listsFailed: number;
  total: number;
  stages: number[]; // teoria, nível 1, 2, 3, dominado
  retainedNow: number;
  hard: number;
  /** assuntos com mais dificuldade agora */
  struggling: string[];
}

export interface PanelTopic {
  key: string;
  title: string;
  discipline: string;
  failed: number;
  passed: number;
  students: number;
  accuracy: number | null;
}

/** respostas mínimas no período para entrar nos rankings de acerto e de evolução */
export const MIN_ANSWERS = 5;

export async function mentorPanel(days: number) {
  const today = todayBR();
  const start = shift(today, -days + 1);
  const before = shift(start, -days);
  const people = await sql.query<{ id: string; name: string; email: string; status: string; group: string; uid: string | null }>(
    `select m.id, coalesce(nullif(m.student_name, ''), m.student_email) as name, m.student_email as email, m.status,
            coalesce(g.name, '') as "group",
            (select u.id from users u where lower(u.email) = lower(m.student_email) limit 1) as uid
       from mentorias m left join mentoria_groups g on g.id = m.group_id
      where m.status <> 'ended'`,
  );
  const uids = people.map((p) => p.uid).filter((x): x is string => Boolean(x));
  const [answers, lastAny, trail, stages, struggling, topics] = await Promise.all([
    // respostas por dia (listas + banco fora das listas), do começo do período anterior até hoje
    sql.query<{ uid: string; d: string; n: number; ok: number }>(
      `with r as (
         select user_id, correct, answered_at from list_responses where user_id = any($1) and answered_at >= $2::date
         union all
         select qa.user_id, qa.correct, qa.answered_at from question_answers qa
          where qa.user_id = any($1) and qa.answered_at >= $2::date
            and not exists (select 1 from list_responses lr where lr.user_id = qa.user_id and lr.question_id = qa.question_id)
       )
       select user_id as uid, (answered_at at time zone 'America/Belem')::date::text as d, count(*)::int as n, count(*) filter (where correct)::int as ok
         from r group by 1, 2`,
      [uids, before],
    ),
    sql.query<{ uid: string; last: string | null }>(
      `select user_id as uid, max(answered_at at time zone 'America/Belem')::date::text as last from (
         select user_id, answered_at from list_responses where user_id = any($1)
         union all select user_id, answered_at from question_answers where user_id = any($1)) x group by 1`,
      [uids],
    ),
    sql.query<{ mid: string; done: number; passed: number; failed: number; last: string | null }>(
      `select mentoria_id as mid,
              count(*) filter (where finished_at >= $1::date and status <> 'closed')::int as done,
              count(*) filter (where finished_at >= $1::date and status = 'passed')::int as passed,
              count(*) filter (where finished_at >= $1::date and status = 'failed')::int as failed,
              max(finished_at at time zone 'America/Belem')::date::text as last
         from mentoria_trail_lists group by 1`,
      [start],
    ),
    sql.query<{ mid: string; level: number; n: number; retained: number; hard: number }>(
      `select mentoria_id as mid, least(level, 4) as level, count(*)::int as n,
              count(*) filter (where retained > 0 and level between 1 and 3)::int as retained, count(*) filter (where hard)::int as hard
         from mentoria_cards group by 1, 2`,
    ),
    sql.query<{ mid: string; item_key: string; title: string }>(
      `select mentoria_id as mid, item_key, title from mentoria_cards
        where hard or (retained >= 2 and level between 1 and 3) order by retained desc, retained_total desc`,
    ),
    // onde atacar: assuntos com mais listas sem passar no período (todos os mentorados)
    sql.query<{ item_key: string; discipline: string; failed: number; passed: number; students: number; ok: number; total: number }>(
      `select item_key, discipline, count(*) filter (where status = 'failed')::int as failed, count(*) filter (where status = 'passed')::int as passed,
              count(distinct mentoria_id) filter (where status = 'failed')::int as students,
              coalesce(sum(ok), 0)::int as ok, coalesce(sum(total), 0)::int as total
         from mentoria_trail_lists where level between 1 and 3 and finished_at >= $1::date group by 1, 2
        having count(*) filter (where status = 'failed') > 0 order by 3 desc, 5 desc limit 15`,
      [start],
    ),
  ]);

  const byUid = new Map<string, { d: string; n: number; ok: number }[]>();
  for (const a of answers) byUid.set(a.uid, [...(byUid.get(a.uid) ?? []), a]);
  const lastBy = new Map(lastAny.map((x) => [x.uid, x.last]));
  const trailBy = new Map(trail.map((t) => [t.mid, t]));
  const stageBy = new Map<string, { stages: number[]; retained: number; hard: number }>();
  for (const s of stages) {
    const v = stageBy.get(s.mid) ?? { stages: [0, 0, 0, 0, 0], retained: 0, hard: 0 };
    v.stages[s.level] += s.n;
    v.retained += s.retained;
    v.hard += s.hard;
    stageBy.set(s.mid, v);
  }
  const strBy = new Map<string, string[]>();
  for (const s of struggling) {
    const t = ASSUNTO_BY_KEY.get(s.item_key)?.short ?? s.title;
    strBy.set(s.mid, [...(strBy.get(s.mid) ?? []), t]);
  }
  const pct = (ok: number, n: number) => (n ? Math.round((ok / n) * 100) : null);
  const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);

  const students: PanelStudent[] = people.map((p) => {
    const rows = p.uid ? (byUid.get(p.uid) ?? []) : [];
    const now = rows.filter((r) => r.d >= start);
    const prev = rows.filter((r) => r.d < start && r.d >= before);
    const n = now.reduce((a, r) => a + r.n, 0);
    const ok = now.reduce((a, r) => a + r.ok, 0);
    const n0 = prev.reduce((a, r) => a + r.n, 0);
    const ok0 = prev.reduce((a, r) => a + r.ok, 0);
    const t = trailBy.get(p.id);
    const last = [p.uid ? lastBy.get(p.uid) : null, t?.last].filter((x): x is string => Boolean(x)).sort().pop() ?? null;
    const st = stageBy.get(p.id) ?? { stages: [0, 0, 0, 0, 0], retained: 0, hard: 0 };
    const acc = pct(ok, n);
    const acc0 = pct(ok0, n0);
    return {
      id: p.id,
      name: p.name,
      email: p.email,
      group: p.group,
      status: p.status,
      lastActive: last,
      idleDays: last ? daysBetween(last, today) : null,
      answered: n,
      correct: ok,
      accuracy: acc,
      answeredBefore: n0,
      accuracyBefore: acc0,
      delta: n >= MIN_ANSWERS && n0 >= MIN_ANSWERS && acc !== null && acc0 !== null ? acc - acc0 : null,
      activeDays: new Set(now.map((r) => r.d)).size,
      listsDone: t?.done ?? 0,
      listsPassed: t?.passed ?? 0,
      listsFailed: t?.failed ?? 0,
      total: st.stages.reduce((a, b) => a + b, 0),
      stages: st.stages,
      retainedNow: st.retained,
      hard: st.hard,
      struggling: (strBy.get(p.id) ?? []).slice(0, 4),
    };
  });

  const ranked = students.filter((s) => s.answered >= MIN_ANSWERS);
  const top = <T,>(list: T[], n = 6) => list.slice(0, n);
  const rankings = {
    active: top([...students].filter((s) => s.answered > 0).sort((a, b) => b.answered - a.answered || b.activeDays - a.activeDays)),
    best: top([...ranked].sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0) || b.answered - a.answered)),
    // sem usar: nada no período (ou parado há 7 dias ou mais)
    inactive: top(
      [...students].filter((s) => s.answered === 0 || (s.idleDays ?? 999) >= 7).sort((a, b) => (b.idleDays ?? 9999) - (a.idleDays ?? 9999)),
      10,
    ),
    // mais erram: mais questões erradas no período (empate: menor acerto)
    worst: top([...ranked].sort((a, b) => b.answered - b.correct - (a.answered - a.correct) || (a.accuracy ?? 0) - (b.accuracy ?? 0))),
    improving: top([...students].filter((s) => (s.delta ?? 0) > 0).sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))),
    worsening: top([...students].filter((s) => (s.delta ?? 0) < 0).sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0))),
  };
  const attack: PanelTopic[] = topics.map((t) => ({
    key: t.item_key,
    title: ASSUNTO_BY_KEY.get(t.item_key)?.short ?? t.item_key,
    discipline: DISCIPLINE_NAME[t.discipline] ?? t.discipline,
    failed: t.failed,
    passed: t.passed,
    students: t.students,
    accuracy: pct(t.ok, t.total),
  }));
  const sum = (f: (s: PanelStudent) => number) => students.reduce((a, s) => a + f(s), 0);
  const totals = {
    students: students.length,
    active: students.filter((s) => s.answered > 0).length,
    answered: sum((s) => s.answered),
    accuracy: pct(sum((s) => s.correct), sum((s) => s.answered)),
    lists: sum((s) => s.listsDone),
    mastered: sum((s) => s.stages[4]),
    subjects: sum((s) => s.total),
  };
  return { days, start, today, totals, students, rankings, attack };
}

export type MentorPanel = Awaited<ReturnType<typeof mentorPanel>>;
