import type { EnemArea, SimuladoStats, Tier } from './types';

/**
 * Motor de nota estilo TRI (ENEM), portado do projeto original.
 * Diferença principal: roda UMA vez no servidor quando o admin libera/recalcula
 * os resultados e grava em `simulado_results`. Os alunos só leem a própria linha,
 * então milhares de acessos simultâneos não refazem o cálculo.
 */

interface Anchor {
  hits: number;
  min: number;
  mean: number;
  max: number;
}

const ANCHORS: Record<EnemArea, Anchor[]> = {
  MT: [
    { hits: 0, min: 318.4, mean: 326.0, max: 334.2 },
    { hits: 5, min: 336.8, mean: 372.5, max: 438.0 },
    { hits: 10, min: 365.4, mean: 478.2, max: 568.9 },
    { hits: 15, min: 452.1, mean: 584.6, max: 658.4 },
    { hits: 20, min: 558.7, mean: 662.3, max: 718.5 },
    { hits: 25, min: 642.0, mean: 724.8, max: 769.2 },
    { hits: 30, min: 712.5, mean: 778.4, max: 816.0 },
    { hits: 35, min: 776.2, mean: 829.5, max: 864.8 },
    { hits: 40, min: 842.0, mean: 886.7, max: 918.5 },
    { hits: 43, min: 904.5, mean: 929.8, max: 951.2 },
    { hits: 45, min: 961.9, mean: 968.7, max: 975.6 },
  ],
  CN: [
    { hits: 0, min: 315.0, mean: 324.2, max: 332.8 },
    { hits: 5, min: 341.2, mean: 379.4, max: 439.6 },
    { hits: 10, min: 368.0, mean: 468.5, max: 544.2 },
    { hits: 15, min: 455.8, mean: 548.9, max: 612.4 },
    { hits: 20, min: 538.4, mean: 609.7, max: 659.8 },
    { hits: 25, min: 604.2, mean: 658.4, max: 698.5 },
    { hits: 30, min: 658.9, mean: 703.2, max: 739.6 },
    { hits: 35, min: 709.5, mean: 748.8, max: 784.2 },
    { hits: 40, min: 764.8, mean: 798.5, max: 834.0 },
    { hits: 43, min: 814.2, mean: 836.0, max: 856.4 },
    { hits: 45, min: 858.0, mean: 863.2, max: 868.4 },
  ],
  CH: [
    { hits: 0, min: 306.5, mean: 314.8, max: 323.0 },
    { hits: 5, min: 328.5, mean: 368.0, max: 429.4 },
    { hits: 10, min: 358.2, mean: 451.4, max: 528.6 },
    { hits: 15, min: 439.5, mean: 524.8, max: 588.2 },
    { hits: 20, min: 512.0, mean: 581.6, max: 632.5 },
    { hits: 25, min: 574.6, mean: 629.4, max: 671.8 },
    { hits: 30, min: 628.5, mean: 673.8, max: 711.4 },
    { hits: 35, min: 679.2, mean: 719.5, max: 754.8 },
    { hits: 40, min: 734.0, mean: 769.2, max: 802.6 },
    { hits: 43, min: 784.5, mean: 808.4, max: 827.0 },
    { hits: 45, min: 831.0, mean: 835.1, max: 839.2 },
  ],
  LC: [
    { hits: 0, min: 298.0, mean: 306.4, max: 315.2 },
    { hits: 5, min: 319.8, mean: 361.2, max: 421.0 },
    { hits: 10, min: 352.0, mean: 442.6, max: 516.4 },
    { hits: 15, min: 431.2, mean: 512.5, max: 571.8 },
    { hits: 20, min: 501.4, mean: 564.8, max: 612.0 },
    { hits: 25, min: 558.2, mean: 608.6, max: 648.4 },
    { hits: 30, min: 608.9, mean: 649.5, max: 685.2 },
    { hits: 35, min: 656.4, mean: 692.4, max: 726.0 },
    { hits: 40, min: 708.5, mean: 741.8, max: 774.5 },
    { hits: 43, min: 758.2, mean: 782.0, max: 803.4 },
    { hits: 45, min: 810.4, mean: 814.5, max: 818.6 },
  ],
};

const r1 = (n: number) => Number(n.toFixed(1));

export function triBounds(area: EnemArea, correct: number, total: number) {
  const safeTotal = Math.max(1, total);
  const scaled = (Math.max(0, Math.min(safeTotal, correct)) / safeTotal) * 45;
  const table = ANCHORS[area] ?? ANCHORS.MT;
  if (scaled <= table[0].hits) return { min: table[0].min, mean: table[0].mean, max: table[0].max };
  const last = table[table.length - 1];
  if (scaled >= last.hits) return { min: last.min, mean: last.mean, max: last.max };
  for (let i = 0; i < table.length - 1; i++) {
    const a = table[i];
    const b = table[i + 1];
    if (scaled >= a.hits && scaled <= b.hits) {
      const t = (scaled - a.hits) / Math.max(0.0001, b.hits - a.hits);
      return {
        min: r1(a.min + (b.min - a.min) * t),
        mean: r1(a.mean + (b.mean - a.mean) * t),
        max: r1(a.max + (b.max - a.max) * t),
      };
    }
  }
  return { min: last.min, mean: last.mean, max: last.max };
}

export interface TriInputSubmission {
  user_id: string;
  answers: string;
}

export interface TriResultRow {
  user_id: string;
  correct: number;
  wrong: number;
  blank: number;
  accuracy: number;
  coherence: number;
  tri_score: number;
  tri_min: number;
  tri_mean: number;
  tri_max: number;
  tiers: Record<Tier, { correct: number; total: number }>;
  breakdown: { q: number; marked: string; official: string; ok: boolean; tier: Tier }[];
}

export function evaluateCohort(
  area: EnemArea,
  questionCount: number,
  answerKey: string,
  submissions: TriInputSubmission[],
): { rows: TriResultRow[]; stats: SimuladoStats } {
  const qCount = Math.max(1, questionCount);
  const subs = [...submissions].sort((a, b) => a.user_id.localeCompare(b.user_id));
  const n = subs.length;
  const key = (i: number) => answerKey[i] || 'A';

  const hits = new Array<number>(qCount).fill(0);
  for (const s of subs) for (let i = 0; i < qCount; i++) if ((s.answers[i] || '-') === key(i)) hits[i]++;

  // Prior bayesiano suave para turmas pequenas
  const alpha = 1.2;
  const items = Array.from({ length: qCount }, (_, i) => {
    const pos = qCount > 1 ? i / (qCount - 1) : 0.5;
    const prior = Math.max(0.22, Math.min(0.86, 0.76 - pos * 0.42 + Math.sin((i + 1) * 2.1) * 0.14));
    const p = Math.max(0.06, Math.min(0.94, (hits[i] + alpha * prior) / (n + alpha)));
    return { index: i, p, hitPct: n > 0 ? Math.round((hits[i] / n) * 100) : Math.round(p * 100) };
  });

  const tierOf: Tier[] = new Array(qCount).fill('medium');
  [...items]
    .sort((a, b) => b.p - a.p)
    .forEach((it, rank) => {
      const pct = qCount > 1 ? rank / qCount : 0;
      tierOf[it.index] = it.p >= 0.68 || pct < 0.34 ? 'easy' : it.p >= 0.38 || pct < 0.72 ? 'medium' : 'hard';
    });

  const infoW = items.map((it) => Math.max(0.08, it.p * (1 - it.p) * 4));

  const rows: TriResultRow[] = subs.map((sub) => {
    let correct = 0;
    let wrong = 0;
    let blank = 0;
    const tiers: TriResultRow['tiers'] = {
      easy: { correct: 0, total: 0 },
      medium: { correct: 0, total: 0 },
      hard: { correct: 0, total: 0 },
    };
    const hitIdx: number[] = [];
    const missIdx: number[] = [];
    const breakdown = items.map((it) => {
      const marked = sub.answers[it.index] || '-';
      const official = key(it.index);
      const ok = marked === official;
      if (marked === '-') blank++;
      else if (ok) correct++;
      else wrong++;
      const t = tierOf[it.index];
      tiers[t].total++;
      if (ok) tiers[t].correct++;
      (ok ? hitIdx : missIdx).push(it.index);
      return { q: it.index + 1, marked, official, ok, tier: t };
    });

    // 1. Coerência pedagógica (Guttman ponderado)
    let coherent = 0;
    let total = 0;
    if (hitIdx.length === qCount) {
      coherent = 1;
      total = 1;
    } else if (hitIdx.length === 0) {
      coherent = 0.5;
      total = 1;
    } else {
      for (const i of hitIdx) {
        for (const j of missIdx) {
          const w = Math.max(0.04, Math.abs(items[i].p - items[j].p));
          if (items[i].p >= items[j].p - 0.015) {
            coherent += w;
            total += w;
          } else {
            total += w * 1.35;
          }
        }
      }
    }
    const pair = total > 0 ? coherent / total : 0.7;

    // 2. Monotonicidade fácil >= médio >= difícil
    const er = tiers.easy.total ? tiers.easy.correct / tiers.easy.total : 1;
    const mr = tiers.medium.total ? tiers.medium.correct / tiers.medium.total : 0.5;
    const hr = tiers.hard.total ? tiers.hard.correct / tiers.hard.total : 0;
    let bonus = 0;
    bonus += er >= mr ? 0.04 : -(mr - er) * 0.18;
    bonus += mr >= hr ? 0.03 : -(hr - mr) * 0.22;
    const coh = Math.max(0.12, Math.min(0.99, pair + bonus));

    // 3. Alinhamento com a informação dos itens
    let earned = 0;
    let possible = 0;
    for (let i = 0; i < qCount; i++) {
      const w = infoW[i] * (0.65 + 0.35 * items[i].p);
      possible += w;
      if (breakdown[i].ok) earned += w;
    }
    const raw = correct / qCount;
    const infoRatio = possible > 0 ? earned / possible : raw;
    const align = Math.max(0, Math.min(1, 0.5 + (infoRatio - raw) * 2.2));
    const composite = coh * 0.75 + align * 0.25;

    const b = triBounds(area, correct, qCount);
    const score =
      composite >= 0.55
        ? b.mean + (b.max - b.mean) * Math.min(1, (composite - 0.55) / 0.42)
        : b.mean - (b.mean - b.min) * Math.min(1, (0.55 - composite) / 0.43);

    return {
      user_id: sub.user_id,
      correct,
      wrong,
      blank,
      accuracy: Math.round(raw * 100),
      coherence: Math.round(coh * 100),
      tri_score: r1(score),
      tri_min: b.min,
      tri_mean: b.mean,
      tri_max: b.max,
      tiers,
      breakdown,
    };
  });

  const avg = (f: (r: TriResultRow) => number) => (rows.length ? rows.reduce((a, r) => a + f(r), 0) / rows.length : 0);

  return {
    rows,
    stats: {
      completed: rows.length,
      meanTri: r1(avg((r) => r.tri_score)),
      meanAccuracy: Math.round(avg((r) => r.accuracy)),
      meanCorrect: r1(avg((r) => r.correct)),
      meanCoherence: Math.round(avg((r) => r.coherence)),
      items: items.map((it) => ({ q: it.index + 1, hitPct: it.hitPct, tier: tierOf[it.index] })),
    },
  };
}
