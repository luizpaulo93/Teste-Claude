import 'server-only';
import { sql } from '@/lib/db';
import { DISCIPLINES } from '@/lib/enem-matriz';

/** Números de um assunto (somando todas as vezes que foi feito). */
export interface TopicStat {
  key: string;
  title: string;
  discipline: string;
  students: number;
  questions: number;
  correct: number;
  errors: number;
  acc: number;
  /** quantas vezes marcaram "ladeira abaixo" / "mais ou menos" / "de boas" */
  hard: number;
  medium: number;
  easy: number;
}

export interface DisciplineStat {
  name: string;
  questions: number;
  acc: number;
  studied: number;
  total: number;
}

export interface StudentReport {
  id: string;
  name: string;
  email: string;
  studied: number;
  total: number;
  /** quantos assuntos em cada situação: não estudado, estudado, revisão 01, 02, 03 */
  levels: number[];
  questions: number;
  acc: number;
  lastDay: string | null;
  hardest: TopicStat[];
  mostErrors: TopicStat[];
  best: TopicStat[];
  disciplines: DisciplineStat[];
  /** tudo o que fez no período: assunto, questões, acertos e como achou */
  done: { d: string; title: string; discipline: string; q: number; c: number; acc: number; f?: number; l: number }[];
}

export interface MentoriaReport {
  title: string;
  /** semana do relatório (AAAA-MM-DD) */
  week?: { from: string; to: string };
  generatedAt: string;
  general: {
    students: number;
    questions: number;
    acc: number;
    studied: number;
    total: number;
    levels: number[];
    hardest: TopicStat[];
    mostErrors: TopicStat[];
    best: TopicStat[];
    disciplines: DisciplineStat[];
  };
  students: StudentReport[];
}

type Row = {
  mentoria_id: string;
  name: string;
  email: string;
  item_key: string;
  discipline: string;
  title: string;
  level: number;
  history: { d: string; q: number; c: number; l: number; f?: number }[] | null;
};

const NAMES = Object.fromEntries(DISCIPLINES.map((d) => [d.key, d.name]));
const pct = (c: number, q: number) => (q ? Math.round((c / q) * 100) : 0);

function topics(rows: Row[]) {
  const by = new Map<string, TopicStat & { who: Set<string> }>();
  for (const r of rows) {
    const h = r.history ?? [];
    if (!h.length) continue;
    const t = by.get(r.item_key) ?? { key: r.item_key, title: r.title, discipline: NAMES[r.discipline] ?? r.discipline, students: 0, questions: 0, correct: 0, errors: 0, acc: 0, hard: 0, medium: 0, easy: 0, who: new Set<string>() };
    for (const e of h) {
      t.questions += e.q;
      t.correct += e.c;
      if (e.f === 3) t.hard++;
      else if (e.f === 2) t.medium++;
      else if (e.f === 1) t.easy++;
    }
    t.who.add(r.mentoria_id);
    by.set(r.item_key, t);
  }
  return [...by.values()].map(({ who, ...t }) => ({ ...t, students: who.size, errors: t.questions - t.correct, acc: pct(t.correct, t.questions) }));
}

function rank(list: TopicStat[], n = 10) {
  return {
    // Maior dificuldade: "ladeira abaixo" primeiro, depois "mais ou menos", depois o menor acerto
    hardest: list.filter((t) => t.hard + t.medium > 0).sort((a, b) => b.hard - a.hard || b.medium - a.medium || a.acc - b.acc).slice(0, n),
    // Mais erros: mais questões erradas, depois o menor acerto
    mostErrors: list.filter((t) => t.errors > 0).sort((a, b) => b.errors - a.errors || a.acc - b.acc).slice(0, n),
    best: list.filter((t) => t.questions > 0 && t.acc >= 70).sort((a, b) => b.acc - a.acc || b.questions - a.questions).slice(0, n),
  };
}

function disciplines(rows: Row[]): DisciplineStat[] {
  const by = new Map<string, DisciplineStat>();
  for (const r of rows) {
    const d = by.get(r.discipline) ?? { name: NAMES[r.discipline] ?? r.discipline, questions: 0, acc: 0, studied: 0, total: 0, c: 0 };
    d.total++;
    if (r.level > 0) d.studied++;
    for (const e of r.history ?? []) {
      d.questions += e.q;
      (d as DisciplineStat & { c: number }).c += e.c;
    }
    by.set(r.discipline, d);
  }
  return [...by.values()].map((d) => ({ name: d.name, questions: d.questions, studied: d.studied, total: d.total, acc: pct((d as DisciplineStat & { c: number }).c, d.questions) }));
}

const levels = (rows: Row[]) => [0, 1, 2, 3, 4].map((l) => rows.filter((r) => Math.min(4, r.level) === l).length);

/** Relatório de uma ou várias mentorias (grupo: geral + cada aluno). */
export async function buildReport(ids: string[], title: string, week?: { from: string; to: string }): Promise<MentoriaReport> {
  const rows = ids.length
    ? await sql.query<Row>(
        `select c.mentoria_id, coalesce(nullif(m.student_name, ''), m.student_email) as name, m.student_email as email,
                c.item_key, c.discipline, c.title, c.level, c.history
           from mentoria_cards c join mentorias m on m.id = c.mentoria_id
          where c.mentoria_id = any($1)`,
        [ids],
      )
    : [];
  // Só o que foi feito na semana escolhida (a situação de cada assunto é a atual)
  if (week) for (const r of rows) r.history = (r.history ?? []).filter((h) => h.d >= week.from && h.d <= week.to);
  const all = topics(rows);
  const q = all.reduce((a, t) => a + t.questions, 0);
  const c = all.reduce((a, t) => a + t.correct, 0);
  const members = [...new Set(rows.map((r) => r.mentoria_id))];
  // quem estudou na semana: tem pelo menos um registro no período
  const students: StudentReport[] = members
    .map((id) => {
      const mine = rows.filter((r) => r.mentoria_id === id);
      const t = topics(mine);
      const sq = t.reduce((a, x) => a + x.questions, 0);
      const sc = t.reduce((a, x) => a + x.correct, 0);
      const days = mine.flatMap((r) => (r.history ?? []).map((h) => h.d)).sort();
      return {
        id,
        name: mine[0].name,
        email: mine[0].email,
        studied: mine.filter((r) => r.level > 0).length,
        total: mine.length,
        levels: levels(mine),
        questions: sq,
        acc: pct(sc, sq),
        lastDay: days.at(-1) ?? null,
        ...rank(t, 5),
        disciplines: disciplines(mine),
        done: mine
          .flatMap((r) => (r.history ?? []).map((h) => ({ d: h.d, title: r.title, discipline: NAMES[r.discipline] ?? r.discipline, q: h.q, c: h.c, acc: pct(h.c, h.q), f: h.f, l: h.l })))
          .sort((a, b) => a.d.localeCompare(b.d)),
      };
    })
    // Quem precisa de mais atenção primeiro: menor acerto, depois quem estudou menos
    .sort((a, b) => (a.questions ? a.acc : 101) - (b.questions ? b.acc : 101) || a.studied - b.studied);
  return {
    title,
    week,
    generatedAt: new Date().toISOString(),
    general: {
      students: members.length,
      questions: q,
      acc: pct(c, q),
      studied: rows.filter((r) => r.level > 0).length,
      total: rows.length,
      levels: levels(rows),
      ...rank(all, 10),
      disciplines: disciplines(rows),
    },
    students,
  };
}
