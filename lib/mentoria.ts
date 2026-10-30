/** Regras do cronograma por assuntos: etapas, revisões e distribuição pelos horários do aluno. */

export const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

/** Situação do assunto (cores pedidas: vermelho, amarelo, revisões). */
export const LEVELS = [
  { label: 'Não estudado', dot: 'bg-red-500', chip: 'bg-red-500/15 text-red-500' },
  { label: 'Estudado', dot: 'bg-amber-400', chip: 'bg-amber-400/15 text-amber-500' },
  { label: 'Revisão 01', dot: 'bg-sky-400', chip: 'bg-sky-400/15 text-sky-500' },
  { label: 'Revisão 02', dot: 'bg-blue-500', chip: 'bg-blue-500/15 text-blue-500' },
  { label: 'Revisão 03', dot: 'bg-emerald-500', chip: 'bg-emerald-500/15 text-emerald-500' },
] as const;

/** Etapas do card no quadro */
export const STEPS = [
  { key: 'study', label: 'Estudar' },
  { key: 'questions', label: 'Resolver questões' },
  { key: 'score', label: 'Marcar desempenho' },
] as const;
export type Step = (typeof STEPS)[number]['key'];

/** Acerto mínimo para avançar de etapa de revisão */
export const PASS = 70;
/** Dias até a próxima revisão depois de chegar no nível (1 → revisão 1 etc.) */
const NEXT_REVIEW = [0, 1, 7, 21];
/** Errou muito: volta a revisar em */
const RETRY_DAYS = 2;
/** Minutos que cada card ocupa no dia */
export const COST = { novo: 60, revisao: 30 };

/** Data de hoje no horário do Brasil (AAAA-MM-DD). */
export function todayBR() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Belem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function shift(date: string, days: number) {
  const t = new Date(`${date}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

/** 0 = segunda … 6 = domingo */
export function weekdayIndex(date: string) {
  return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
}

export function daysUntil(date: string | null) {
  if (!date) return null;
  return Math.round((new Date(`${date}T12:00:00Z`).getTime() - new Date(`${todayBR()}T12:00:00Z`).getTime()) / 86400000);
}

/**
 * Resultado de "marcar desempenho":
 * - assunto novo → vira "Estudado" e a revisão 01 fica para amanhã;
 * - revisão com acerto ≥ 70% → sobe de nível (próxima revisão em 7 e depois 21 dias; a 03 conclui);
 * - revisão com acerto baixo → continua no mesmo nível e volta em 2 dias, até melhorar.
 */
export function afterScore(level: number, questions: number, correct: number, today: string) {
  const acc = questions ? Math.round((correct / questions) * 100) : 0;
  if (level === 0) return { level: 1, acc, due: shift(today, NEXT_REVIEW[1]) };
  if (acc >= PASS) {
    const next = Math.min(4, level + 1);
    return { level: next, acc, due: next >= 4 ? null : shift(today, NEXT_REVIEW[next]) };
  }
  return { level, acc, due: shift(today, RETRY_DAYS) };
}

export interface PlanCard {
  id: string;
  level: number;
  step: string;
  ord: number;
  due_on: string | null;
}

/**
 * Distribui os cards nos próximos dias conforme os minutos livres de cada dia:
 * primeiro o que já está em andamento (hoje), depois as revisões vencidas, depois assuntos novos na ordem.
 */
export function schedule(cards: PlanCard[], availability: number[], today: string, horizon = 14, doneToday = { minutes: 0, count: 0 }) {
  const out = new Map<string, string | null>();
  const days = Array.from({ length: horizon }, (_, i) => shift(today, i));
  const left = new Map(days.map((d) => [d, Math.max(0, Number(availability[weekdayIndex(d)]) || 0)]));
  const used = new Map(days.map((d) => [d, 0]));
  // O que já foi concluído hoje ocupa o tempo de hoje
  left.set(today, Math.max(0, left.get(today)! - doneToday.minutes));
  used.set(today, doneToday.count);
  const take = (d: string, min: number, force = false) => {
    const free = left.get(d)!;
    if (free >= min || (force && used.get(d) === 0 && free > 0)) {
      left.set(d, free - min);
      used.set(d, used.get(d)! + 1);
      return true;
    }
    return false;
  };

  for (const c of cards) if (c.level >= 4) out.set(c.id, null);
  const open = cards.filter((c) => c.level < 4);
  // Em andamento (já começou hoje): fica hoje
  for (const c of open.filter((c) => c.step !== 'study')) {
    take(today, c.level ? COST.revisao : COST.novo, true);
    out.set(c.id, today);
  }
  const rest = open.filter((c) => c.step === 'study');
  // Revisões pela data
  for (const c of rest.filter((c) => c.level > 0).sort((a, b) => (a.due_on ?? '').localeCompare(b.due_on ?? '') || a.ord - b.ord)) {
    const from = c.due_on && c.due_on > today ? c.due_on : today;
    const day = days.find((d) => d >= from && take(d, COST.revisao, true));
    out.set(c.id, day ?? null);
  }
  // Assuntos novos na ordem do plano
  let i = 0;
  const news = rest.filter((c) => c.level === 0).sort((a, b) => a.ord - b.ord);
  for (const d of days) {
    while (i < news.length && take(d, COST.novo, true)) out.set(news[i++].id, d);
  }
  for (; i < news.length; i++) out.set(news[i].id, null);
  return out;
}
