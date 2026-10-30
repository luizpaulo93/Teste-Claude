/** Regras do cronograma por assuntos: etapas, revisões e distribuição pelos horários do aluno. */

export const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

/** Situação do assunto (cores: vermelho, amarelo e as revisões). */
export const LEVELS = [
  { label: 'Não estudado', dot: 'bg-red-500', chip: 'bg-red-500/15 text-red-500' },
  { label: 'Estudado', dot: 'bg-amber-400', chip: 'bg-amber-400/15 text-amber-500' },
  { label: 'Revisão 01', dot: 'bg-sky-400', chip: 'bg-sky-400/15 text-sky-500' },
  { label: 'Revisão 02', dot: 'bg-blue-500', chip: 'bg-blue-500/15 text-blue-500' },
  { label: 'Revisão 03', dot: 'bg-emerald-500', chip: 'bg-emerald-500/15 text-emerald-500' },
] as const;

/** O que o aluno faz no card, conforme o nível em que o assunto está */
export const TASK_KIND = ['Estudar', 'Revisão 01', 'Revisão 02', 'Revisão 03', 'Revisão de manutenção'];

/** Meta de acerto para passar em cada revisão (nível 1 → Revisão 01 …) */
export const GOAL = [0, 40, 60, 70, 70];
/** Dias até a próxima vez: depois de estudar 7, depois da 01 14, da 02 28 e da 03 em diante 60 */
const NEXT = [7, 7, 14, 28, 60];
/** Não bateu a meta: volta na semana seguinte */
const RETRY = 7;
/** Minutos que cada assunto ocupa no dia */
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
 * Questões resolvidas (feitas e acertos):
 * - assunto novo → "Estudado"; a Revisão 01 vem em 7 dias;
 * - revisão que bate a meta (01: 40%, 02: 60%, 03: 70%) sobe de nível;
 * - não bateu → continua no mesmo nível e volta na semana seguinte, até bater;
 * - depois da Revisão 03 o assunto continua voltando, a cada 60 dias.
 */
export function afterScore(level: number, questions: number, correct: number, today: string, feel = 1) {
  const acc = questions ? Math.round((correct / questions) * 100) : 0;
  const r =
    level === 0
      ? { level: 1, acc, days: NEXT[1], passed: true, goal: 0 }
      : acc >= GOAL[Math.min(level, 4)]
        ? { level: Math.min(4, level + 1), acc, days: NEXT[Math.min(4, level + 1)], passed: true, goal: GOAL[Math.min(level, 4)] }
        : { level, acc, days: RETRY, passed: false, goal: GOAL[Math.min(level, 4)] };
  // Personalizado pelo que o aluno sentiu: "ladeira abaixo" volta em 3 dias; "mais ou menos" volta na metade do tempo
  const days = feel >= 3 ? Math.min(r.days, 3) : feel === 2 ? Math.max(3, Math.round(r.days / 2)) : r.days;
  return { level: r.level, acc: r.acc, passed: r.passed, goal: r.goal, due: shift(today, days) };
}

/** Como o aluno achou o assunto */
export const FEELS = [
  { value: 1, label: 'Achei de boas', emoji: '😎' },
  { value: 2, label: 'Foi mais ou menos', emoji: '😐' },
  { value: 3, label: 'Ladeira abaixo', emoji: '😵' },
] as const;

export interface PlanCard {
  id: string;
  level: number;
  step: string;
  ord: number;
  due_on: string | null;
}

/**
 * Distribui os assuntos do dia de hoje até o fim da mentoria, nos minutos livres de cada dia.
 * Em cada dia: o que já está em andamento, depois as revisões, depois assuntos novos (ordem do plano:
 * mais cobrados primeiro). Cada assunto novo já reserva o tempo das suas revisões futuras (7, 21 e 49 dias),
 * para o cronograma fechar dentro do período. O que não couber fica fora (os menos cobrados).
 */
export function schedule(cards: PlanCard[], availability: number[], today: string, end: string, doneToday = { minutes: 0, count: 0 }) {
  const out = new Map<string, string | null>();
  const last = end < today ? today : end;
  const days: string[] = [];
  for (let d = today; d <= last && days.length < 500; d = shift(d, 1)) days.push(d);
  const free = (d: string) => Math.max(0, Number(availability[weekdayIndex(d)]) || 0) - (d === today ? doneToday.minutes : 0);

  const active = cards.filter((c) => c.step !== 'study');
  const reviews = cards.filter((c) => c.step === 'study' && c.level > 0).sort((a, b) => (a.due_on ?? '').localeCompare(b.due_on ?? '') || a.ord - b.ord);
  const news = cards.filter((c) => c.step === 'study' && c.level === 0).sort((a, b) => a.ord - b.ord);
  const projected: string[] = []; // datas de revisões futuras reservadas
  let r = 0;
  let n = 0;

  for (const d of days) {
    let left = free(d);
    let count = d === today ? doneToday.count : 0;
    const fits = (min: number) => left >= min || (count === 0 && left > 0);
    if (d === today)
      for (const c of active) {
        out.set(c.id, d);
        left -= c.level ? COST.revisao : COST.novo;
        count++;
      }
    // Revisões vencidas (reais)
    while (r < reviews.length && (reviews[r].due_on ?? today) <= d && fits(COST.revisao)) {
      out.set(reviews[r++].id, d);
      left -= COST.revisao;
      count++;
    }
    // Revisões futuras reservadas
    projected.sort();
    while (projected.length && projected[0] <= d && fits(COST.revisao)) {
      projected.shift();
      left -= COST.revisao;
      count++;
    }
    // Assuntos novos
    while (n < news.length && fits(COST.novo)) {
      out.set(news[n++].id, d);
      left -= COST.novo;
      count++;
      for (const k of [7, 21, 49]) if (shift(d, k) <= last) projected.push(shift(d, k));
    }
  }
  for (; r < reviews.length; r++) out.set(reviews[r].id, null);
  for (; n < news.length; n++) out.set(news[n].id, null);
  return out;
}
