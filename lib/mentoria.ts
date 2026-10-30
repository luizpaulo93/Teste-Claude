/** Regras da mentoria: matérias, cronograma automático, revisão espaçada e estatísticas. */
import type { Mentoria, MentoriaSession } from './types';

export const SUBJECTS = [
  'Matemática',
  'Física',
  'Química',
  'Biologia',
  'Português',
  'Literatura',
  'Redação',
  'Inglês/Espanhol',
  'História',
  'Geografia',
  'Filosofia',
  'Sociologia',
] as const;

export const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

/** Intervalos da revisão espaçada (dias) */
export const REVIEW_STEPS = [1, 7, 15, 30];

/** Data de hoje no horário do Brasil (AAAA-MM-DD). */
export function todayBR() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Belem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function daysUntil(date: string | null) {
  if (!date) return null;
  const a = new Date(`${todayBR()}T12:00:00Z`).getTime();
  const b = new Date(`${date}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

export function levelOf(m: Pick<Mentoria, 'subject_levels'>, subject: string) {
  const v = Number(m.subject_levels?.[subject]);
  return v >= 1 && v <= 5 ? v : 3;
}

export interface PlannedTask {
  day: number; // 0 = segunda
  subject: string;
  kind: 'aula' | 'questoes' | 'revisao' | 'simulado';
  title: string;
  minutes: number;
}

/**
 * Cronograma da semana a partir da disponibilidade de cada dia e do nível em cada matéria:
 * matéria mais fraca recebe mais blocos; cada bloco alterna teoria e questões;
 * redação toda semana; revisão do caderno de erros; simulado no dia mais livre do fim de semana.
 */
export function planWeek(
  m: Pick<Mentoria, 'availability' | 'subject_levels'>,
  reviewsDue: number,
  fromDay = 0,
  topicFor: (subject: string) => string = () => '',
): PlannedTask[] {
  // Dias que já passaram (semana atual) ficam de fora
  const avail = (m.availability ?? []).slice(0, 7).map((v, d) => (d < fromDay ? 0 : Math.max(0, Math.min(720, Number(v) || 0))));
  while (avail.length < 7) avail.push(0);
  const out: PlannedTask[] = [];
  const total = avail.reduce((a, b) => a + b, 0);
  if (!total) return out;

  // Simulado: no fim de semana com 3 h+ livres (semana com 10 h+)
  const simDay = total >= 600 ? [5, 6].filter((d) => avail[d] >= 180).sort((a, b) => avail[b] - avail[a])[0] : undefined;
  if (simDay !== undefined) {
    out.push({ day: simDay, subject: '', kind: 'simulado', title: 'Simulado cronometrado', minutes: 180 });
    avail[simDay] -= 180;
  }
  // Revisão do caderno de erros: 30 min em 2 dias
  if (reviewsDue > 0) {
    const days = avail.map((v, d) => [v, d]).filter(([v]) => v >= 30).sort((a, b) => b[0] - a[0]).slice(0, 2).map(([, d]) => d);
    for (const d of days) {
      out.push({ day: d, subject: '', kind: 'revisao', title: 'Revisar o caderno de erros', minutes: 30 });
      avail[d] -= 30;
    }
  }
  // Redação: 1 bloco de 60 min (2 se a semana for longa)
  const redacoes = total >= 900 ? 2 : 1;
  for (let i = 0; i < redacoes; i++) {
    const d = avail.indexOf(Math.max(...avail));
    if (avail[d] >= 50) {
      out.push({ day: d, subject: 'Redação', kind: 'questoes', title: 'Redação: escrever um texto e revisar', minutes: 60 });
      avail[d] -= 60;
    }
  }
  // Demais matérias: número de blocos proporcional à dificuldade (mais fraco = mais blocos)
  const subjects = SUBJECTS.filter((s) => s !== 'Redação');
  const weight = (s: string) => (6 - levelOf(m, s)) ** 1.6; // nível 1 ≈ 13x o peso do nível 5
  const slots: { day: number; min: number }[] = [];
  for (let d = 0; d < 7; d++) {
    let left = avail[d];
    while (left >= 25) {
      const block = left >= 50 ? 50 : left;
      slots.push({ day: d, min: block });
      left -= block;
    }
  }
  const sumW = subjects.reduce((a, s) => a + weight(s), 0);
  const raw = subjects.map((s) => ({ s, q: (slots.length * weight(s)) / sumW }));
  const quota = new Map(raw.map((r) => [r.s, Math.floor(r.q)]));
  let rest = slots.length - [...quota.values()].reduce((a, b) => a + b, 0);
  for (const r of [...raw].sort((x, y) => y.q - Math.floor(y.q) - (x.q - Math.floor(x.q)))) {
    if (rest <= 0) break;
    quota.set(r.s, quota.get(r.s)! + 1);
    rest--;
  }
  // Distribui nos dias: cada dia pega quem ainda tem mais blocos, sem repetir matéria no mesmo dia
  const turn = new Map<string, number>(subjects.map((s) => [s, 0]));
  const usedDay = new Map<number, Set<string>>();
  for (const slot of slots) {
    const used = usedDay.get(slot.day) ?? new Set<string>();
    usedDay.set(slot.day, used);
    const pick =
      subjects.filter((s) => quota.get(s)! > 0 && !used.has(s)).sort((a, b) => quota.get(b)! - quota.get(a)! || weight(b) - weight(a))[0] ??
      subjects.filter((s) => quota.get(s)! > 0).sort((a, b) => quota.get(b)! - quota.get(a)!)[0];
    if (!pick) break;
    quota.set(pick, quota.get(pick)! - 1);
    used.add(pick);
    const t = turn.get(pick)!;
    turn.set(pick, t + 1);
    const kind = t % 2 === 0 ? 'aula' : 'questoes';
    const topic = topicFor(pick);
    out.push({
      day: slot.day,
      subject: pick,
      kind,
      title: topic ? `${pick}: ${topic} — ${kind === 'aula' ? 'teoria + resumo' : 'questões'}` : kind === 'aula' ? `${pick}: teoria + resumo` : `${pick}: bloco de questões`,
      minutes: slot.min,
    });
  }
  return out.sort((a, b) => a.day - b.day);
}

/** Dias seguidos com estudo registrado (até hoje ou ontem). */
export function streak(sessions: Pick<MentoriaSession, 'studied_on' | 'minutes' | 'questions'>[]) {
  const days = new Set(sessions.filter((s) => s.minutes > 0 || s.questions > 0).map((s) => s.studied_on));
  let d = todayBR();
  if (!days.has(d)) d = shift(d, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = shift(d, -1);
  }
  return n;
}

function shift(date: string, days: number) {
  const t = new Date(`${date}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

/** Acertos por matéria a partir dos registros de questões. */
export function accuracyBySubject(sessions: Pick<MentoriaSession, 'subject' | 'questions' | 'correct'>[]) {
  const by = new Map<string, { q: number; c: number }>();
  for (const s of sessions) {
    if (!s.questions || !s.subject) continue;
    const v = by.get(s.subject) ?? { q: 0, c: 0 };
    v.q += s.questions;
    v.c += s.correct;
    by.set(s.subject, v);
  }
  return [...by.entries()].map(([subject, v]) => ({ subject, questions: v.q, correct: v.c, pct: Math.round((v.c / v.q) * 100) })).sort((a, b) => a.pct - b.pct);
}

export const fmtMinutes = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}` : `${min} min`);
