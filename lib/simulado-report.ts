import 'server-only';
import { getCatalogData, sql } from '@/lib/db';
import type { Simulado, SimuladoStats, Tier } from '@/lib/types';

export interface ReportRow {
  user_id: string;
  name: string;
  email: string;
  class_id: string | null;
  status: 'in_progress' | 'completed';
  duration_seconds: number;
  answers: string;
  /** Acertos (oficial se liberado; senão, conferido com o gabarito) */
  correct: number;
  tri: number | null;
  coherence: number | null;
  accuracy: number;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const r1 = (n: number) => Math.round(n * 10) / 10;

/** Tudo do simulado para o admin: entregas, notas e turma de cada aluno. */
export async function loadSimuladoReport(id: string) {
  const [simulado, key, rows, catalog] = await Promise.all([
    sql.one<Simulado>(`select * from simulados where id = $1`, [id]),
    sql.one<{ answer_key: string }>(`select answer_key from simulado_keys where simulado_id = $1`, [id]),
    sql.query<{
      user_id: string;
      name: string;
      email: string;
      class_id: string | null;
      status: 'in_progress' | 'completed';
      duration_seconds: number;
      answers: string;
      r_correct: number | null;
      tri_score: number | null;
      coherence: number | null;
      accuracy: number | null;
    }>(
      `select s.user_id, coalesce(nullif(st.name, ''), nullif(u.full_name, ''), split_part(u.email, '@', 1), 'Aluno') as name,
              coalesce(u.email, '') as email, st.class_id, s.status, s.duration_seconds, s.answers,
              r.correct as r_correct, r.tri_score, r.coherence, r.accuracy
         from simulado_submissions s
         left join users u on u.id = s.user_id
         left join students st on st.email = u.email
         left join simulado_results r on r.simulado_id = s.simulado_id and r.user_id = s.user_id
        where s.simulado_id = $1`,
      [id],
    ),
    getCatalogData(),
  ]);
  if (!simulado) return null;
  const answerKey = key?.answer_key ?? '';
  const useTri = simulado.use_tri !== false;
  const raw = (answers: string) => [...(answers ?? '')].filter((c, i) => c !== '-' && c === answerKey[i]).length;

  const list: ReportRow[] = rows.map((r) => {
    const correct = r.r_correct ?? (answerKey ? raw(r.answers) : 0);
    return {
      user_id: r.user_id,
      name: r.name,
      email: r.email,
      class_id: r.class_id,
      status: r.status,
      duration_seconds: r.duration_seconds,
      answers: r.answers ?? '',
      correct,
      tri: r.tri_score == null ? null : Number(r.tri_score),
      coherence: r.coherence == null ? null : Number(r.coherence),
      accuracy: r.accuracy == null ? Math.round((correct / Math.max(1, simulado.question_count)) * 100) : Number(r.accuracy),
    };
  });
  // Ranking: nota TRI (se houver) e depois acertos
  const score = (r: ReportRow) => (useTri && r.tri != null ? r.tri : -1);
  list.sort((a, b) => Number(b.status === 'completed') - Number(a.status === 'completed') || score(b) - score(a) || b.correct - a.correct);

  const className = (cid: string | null) => catalog.classes.find((c) => c.id === cid)?.name ?? 'Sem turma';
  return { simulado, answerKey, useTri, rows: list, className, stats: (simulado.stats ?? {}) as Partial<SimuladoStats> };
}

/** Resumo de um grupo de entregas (simulado inteiro ou uma turma). */
export function summarize(rows: ReportRow[], useTri: boolean) {
  const done = rows.filter((r) => r.status === 'completed');
  const tris = done.map((r) => r.tri).filter((x): x is number => x != null);
  return {
    entregas: done.length,
    fazendo: rows.length - done.length,
    meanTri: useTri && tris.length ? r1(avg(tris)) : null,
    best: useTri && tris.length ? r1(Math.max(...tris)) : done.length ? Math.max(...done.map((r) => r.correct)) : null,
    meanCorrect: done.length ? r1(avg(done.map((r) => r.correct))) : null,
    meanAccuracy: done.length ? Math.round(avg(done.map((r) => r.accuracy))) : null,
  };
}

/** % de acerto por questão a partir das entregas (funciona antes e depois de liberar). */
export function questionHits(rows: ReportRow[], answerKey: string, count: number): { q: number; hitPct: number; tier: Tier }[] {
  const done = rows.filter((r) => r.status === 'completed');
  if (!done.length || answerKey.length !== count) return [];
  return Array.from({ length: count }, (_, i) => {
    const hits = done.filter((r) => r.answers[i] === answerKey[i]).length;
    const hitPct = Math.round((hits / done.length) * 100);
    return { q: i + 1, hitPct, tier: hitPct >= 60 ? 'easy' : hitPct >= 30 ? 'medium' : 'hard' };
  });
}

/** Turmas do simulado, em ranking. */
export function classRanking(rows: ReportRow[], useTri: boolean, className: (id: string | null) => string) {
  const by = new Map<string, ReportRow[]>();
  rows.filter((r) => r.status === 'completed').forEach((r) => by.set(r.class_id ?? '', [...(by.get(r.class_id ?? '') ?? []), r]));
  return [...by.entries()]
    .map(([id, list]) => ({ id: id || 'sem-turma', name: className(id || null), ...summarize(list, useTri) }))
    .sort((a, b) => (useTri ? (b.meanTri ?? 0) - (a.meanTri ?? 0) : 0) || (b.meanCorrect ?? 0) - (a.meanCorrect ?? 0));
}
