/** Regras do cronograma por assuntos: etapas, revisões e distribuição pelos horários do aluno. */

export const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

/** Etapa do assunto na trilha: teoria, níveis 1 a 3 e dominado. */
export const LEVELS = [
  { label: 'Teoria', dot: 'bg-zinc-400', chip: 'bg-zinc-500/15 text-ink-2' },
  { label: 'Nível 1', dot: 'bg-sky-400', chip: 'bg-sky-400/15 text-sky-500' },
  { label: 'Nível 2', dot: 'bg-amber-400', chip: 'bg-amber-400/15 text-amber-500' },
  { label: 'Nível 3', dot: 'bg-orange-500', chip: 'bg-orange-500/15 text-orange-500' },
  { label: 'Dominado', dot: 'bg-emerald-500', chip: 'bg-emerald-500/15 text-emerald-500' },
] as const;

/** O que o aluno faz no card, conforme a etapa */
export const TASK_KIND = ['Estudar a teoria', 'Lista Nível 1', 'Lista Nível 2', 'Lista Nível 3', 'Revisão'];

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
  /** dia escolhido pelo aluno (entra além do tempo livre) */
  pinned_on?: string | null;
  /** 3 = mais cobrado no ENEM … 1 = menos */
  priority?: number;
  /** dia em que deveria ter sido feito e não foi (atrasado) */
  late_from?: string | null;
}

/**
 * Distribui os assuntos do dia de hoje até o fim da mentoria, nos minutos livres de cada dia.
 * Em cada dia: o que está em andamento, depois os atrasados (realocados, mais cobrados primeiro), depois as revisões, depois assuntos novos (ordem do plano:
 * mais cobrados primeiro). Cada assunto novo já reserva o tempo das listas dos níveis 2 e 3 (2 e 6 dias depois),
 * para o cronograma fechar dentro do período. O que não couber fica fora (os menos cobrados).
 */
export function schedule(cards: PlanCard[], availability: number[], today: string, end: string, doneToday = { minutes: 0, count: 0 }) {
  const out = new Map<string, string | null>();
  const last = end < today ? today : end;
  const days: string[] = [];
  for (let d = today; d <= last && days.length < 500; d = shift(d, 1)) days.push(d);
  const free = (d: string) => Math.max(0, Number(availability[weekdayIndex(d)]) || 0) - (d === today ? doneToday.minutes : 0);

  // Acrescentados pelo aluno: ficam no dia escolhido, sem tirar nada do que o mentor montou
  const pinned = cards.filter((c) => c.step === 'study' && c.pinned_on);
  for (const c of pinned) out.set(c.id, c.pinned_on! < today ? today : c.pinned_on!);
  const rest = cards.filter((c) => !(c.step === 'study' && c.pinned_on));
  const active = rest.filter((c) => c.step !== 'study' && c.level < 4);
  // listas dos níveis 1 a 3 na data delas; dominados não ocupam dia (voltam dentro das listas, como revisão)
  for (const c of rest) if (c.level >= 4) out.set(c.id, null);
  // Atrasados vêm primeiro (o que atrasou entra antes de tudo nos próximos dias livres),
  // e entre eles os mais cobrados no ENEM; depois, o mais antigo e a ordem do plano
  const late = rest
    .filter((c) => c.step === 'study' && c.level < 4 && c.late_from)
    .sort((a, b) => (b.priority ?? 1) - (a.priority ?? 1) || a.late_from!.localeCompare(b.late_from!) || a.ord - b.ord);
  const isLate = new Set(late.map((c) => c.id));
  const reviews = rest
    .filter((c) => !isLate.has(c.id))
    .filter((c) => c.step === 'study' && c.level > 0 && c.level < 4)
    .sort((a, b) => (a.due_on ?? '').localeCompare(b.due_on ?? '') || a.ord - b.ord);
  const news = rest.filter((c) => !isLate.has(c.id) && c.step === 'study' && c.level === 0).sort((a, b) => a.ord - b.ord);
  const projected: string[] = []; // datas de revisões futuras reservadas
  let r = 0;
  let n = 0;
  let l = 0;

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
    // Atrasados (realocados): primeiro de tudo
    while (l < late.length && fits(late[l].level ? COST.revisao : COST.novo)) {
      const c = late[l++];
      out.set(c.id, d);
      left -= c.level ? COST.revisao : COST.novo;
      count++;
      if (!c.level) for (const k of [2, 6]) if (shift(d, k) <= last) projected.push(shift(d, k));
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
      // a lista do Nível 1 vai junto com a teoria; Nível 2 e 3 vêm alguns dias depois
      for (const k of [2, 6]) if (shift(d, k) <= last) projected.push(shift(d, k));
    }
  }
  for (; l < late.length; l++) out.set(late[l].id, null);
  for (; r < reviews.length; r++) out.set(reviews[r].id, null);
  for (; n < news.length; n++) out.set(news[n].id, null);
  return out;
}

/** Período de estudo de um dia: ["19:00", "21:00"] */
export type StudyWindow = [string, string];

/** Atalhos para montar os períodos */
export const PERIOD_PRESETS: { label: string; from: string; to: string }[] = [
  { label: 'Manhã', from: '08:00', to: '10:00' },
  { label: 'Tarde', from: '14:00', to: '16:00' },
  { label: 'Noite', from: '19:00', to: '21:00' },
];

export const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const fromMinutes = (n: number) => `${String(Math.floor(n / 60) % 24).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
export const windowMinutes = (ws: StudyWindow[]) => ws.reduce((a, [f, t]) => a + Math.max(0, toMinutes(t) - toMinutes(f)), 0);
export const periodName = (from: string) => (toMinutes(from) < 12 * 60 ? 'Manhã' : toMinutes(from) < 18 * 60 ? 'Tarde' : 'Noite');

/** Valida os períodos (7 dias): horários válidos, fim depois do início, em ordem, sem sobrepor, até 4 por dia. */
export function cleanWindows(raw: unknown): StudyWindow[][] {
  const ok = (t: unknown) => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  return Array.from({ length: 7 }, (_, i) => {
    const day = Array.isArray(raw) && Array.isArray(raw[i]) ? (raw[i] as unknown[]) : [];
    const list = day
      .filter((w): w is StudyWindow => Array.isArray(w) && ok(w[0]) && ok(w[1]) && toMinutes(w[1] as string) > toMinutes(w[0] as string))
      .map((w) => [w[0], w[1]] as StudyWindow)
      .sort((a, b) => toMinutes(a[0]) - toMinutes(b[0]));
    const merged: StudyWindow[] = [];
    for (const w of list) {
      const last = merged.at(-1);
      if (last && toMinutes(w[0]) <= toMinutes(last[1])) last[1] = fromMinutes(Math.max(toMinutes(last[1]), toMinutes(w[1])));
      else merged.push([w[0], w[1]]);
    }
    return merged.slice(0, 4);
  });
}

/** Quem só tinha "minutos por dia": vira um período à noite (ou à tarde, se for muito tempo). */
export function windowsFromAvailability(availability: number[]): StudyWindow[][] {
  return Array.from({ length: 7 }, (_, i) => {
    const m = Math.max(0, Math.min(16 * 60, Number(availability[i]) || 0));
    if (!m) return [];
    const start = m > 4 * 60 ? 14 * 60 : 19 * 60;
    return [[fromMinutes(start), fromMinutes(Math.min(start + m, 23 * 60 + 59))]];
  });
}

/** Horário de início de cada sessão do dia, enchendo os períodos em ordem (sobrou sessão: segue do fim). */
export function sessionStarts(windows: StudyWindow[], durations: number[]) {
  const out: string[] = [];
  let w = 0;
  let at = windows[0] ? toMinutes(windows[0][0]) : null;
  for (const d of durations) {
    if (at === null) {
      out.push('');
      continue;
    }
    while (w < windows.length - 1 && at + Math.min(d, 30) > toMinutes(windows[w][1])) {
      w++;
      at = Math.max(at, toMinutes(windows[w][0]));
    }
    out.push(fromMinutes(at));
    at += d;
  }
  return out;
}
