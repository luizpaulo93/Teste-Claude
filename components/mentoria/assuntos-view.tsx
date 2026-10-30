'use client';

import { Flame } from 'lucide-react';
import { useState } from 'react';
import { LEVELS } from '@/lib/mentoria';
import { cn, formatDate } from '@/lib/utils';

export interface AssuntoRow {
  key: string;
  discipline: string;
  block: string;
  title: string;
  priority: number;
  level: number | null; // null = fora do cronograma
  last_acc: number | null;
  due_on: string | null;
  attempts: number;
}

/** Todos os assuntos de cada disciplina e em que parte do estudo o aluno está (cores por situação). */
export function AssuntosView({ rows, disciplines }: { rows: AssuntoRow[]; disciplines: { key: string; name: string }[] }) {
  const [disc, setDisc] = useState(disciplines[0]?.key ?? '');
  const list = rows.filter((r) => r.discipline === disc);
  const count = (l: number) => list.filter((r) => (r.level ?? 0) === l).length;
  const blocks = [...new Set(list.map((r) => r.block))];

  return (
    <div className="space-y-4">
      <div className="rail -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {disciplines.map((d) => {
          const all = rows.filter((r) => r.discipline === d.key);
          const pct = all.length ? Math.round((all.filter((r) => (r.level ?? 0) >= 1).length / all.length) * 100) : 0;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => setDisc(d.key)}
              className={cn('shrink-0 rounded-xl border px-3.5 py-2 text-left text-sm font-semibold transition', disc === d.key ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-2')}
            >
              {d.name} <span className="text-xs opacity-75">{pct}%</span>
            </button>
          );
        })}
      </div>

      {/* Resumo por situação */}
      <div className="space-y-2">
        <div className="flex h-3 overflow-hidden rounded-full bg-surface-3">
          {LEVELS.map((l, i) => (
            <div key={l.label} className={l.dot} style={{ width: `${list.length ? (count(i) / list.length) * 100 : 0}%` }} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-2">
          {LEVELS.map((l, i) => (
            <span key={l.label} className="flex items-center gap-1">
              <span className={cn('size-2.5 rounded-full', l.dot)} /> {l.label} <strong className="text-ink tabular-nums">{count(i)}</strong>
            </span>
          ))}
          <span className="flex items-center gap-1">
            <Flame className="size-3 text-orange-500" /> mais cobrado no ENEM
          </span>
        </div>
      </div>

      {blocks.map((b) => (
        <section key={b} className="overflow-hidden rounded-2xl border border-line bg-surface">
          <p className="border-b border-line bg-surface-2/60 px-4 py-2 text-xs font-bold text-ink-2">{b}</p>
          <ul className="divide-y divide-line">
            {list
              .filter((r) => r.block === b)
              .map((r) => {
                const lv = LEVELS[r.level ?? 0];
                return (
                  <li key={r.key} className="flex items-start gap-3 px-4 py-2.5">
                    <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', lv.dot)} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] leading-snug text-ink">
                        {r.title}
                        {r.priority >= 3 && <Flame className="ml-1 inline size-3.5 text-orange-500" />}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                        <span className={cn('rounded px-1.5 py-0.5 font-bold', lv.chip)}>{lv.label}</span>
                        {r.last_acc !== null && <span>acerto {r.last_acc}%</span>}
                        {r.level !== null && r.level >= 1 && r.level < 4 && r.due_on && <span>· próxima revisão {formatDate(r.due_on)}</span>}
                        {r.level === null && <span>fora do cronograma</span>}
                      </span>
                    </span>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}
