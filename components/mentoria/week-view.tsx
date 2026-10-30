import { Flame } from 'lucide-react';
import { COST, LEVELS, shift, todayBR, WEEKDAYS, weekdayIndex } from '@/lib/mentoria';
import type { Card } from '@/lib/mentoria-data';
import { cn, formatDate } from '@/lib/utils';

const KIND = ['Novo', 'Revisão 01', 'Revisão 02', 'Revisão 03'];
const hours = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}` : `${m} min`);

/** Cronograma dos próximos 7 dias: cada dia com as horas livres do aluno e os cards que cabem nele. */
export function WeekView({ cards, availability, names }: { cards: Card[]; availability: number[]; names: Record<string, string> }) {
  const today = todayBR();
  const days = Array.from({ length: 7 }, (_, i) => shift(today, i));
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {days.map((d) => {
        const list = cards.filter((c) => c.scheduled_on === d && c.level < 4);
        const free = Number(availability[weekdayIndex(d)]) || 0;
        const planned = list.reduce((a, c) => a + (c.level ? COST.revisao : COST.novo), 0);
        return (
          <section key={d} className={cn('rounded-2xl border bg-surface p-3', d === today ? 'border-brand' : 'border-line')}>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <p className="text-sm font-bold text-ink">
                {WEEKDAYS[weekdayIndex(d)]} · {formatDate(d)}
                {d === today && <span className="ml-1.5 text-xs font-semibold text-brand">hoje</span>}
              </p>
              <p className="text-[11px] text-muted tabular-nums">{free ? `${hours(planned)} de ${hours(free)}` : 'sem estudo'}</p>
            </div>
            {list.length ? (
              <ul className="space-y-1.5">
                {list.map((c) => (
                  <li key={c.id} className="flex items-start gap-2 rounded-lg bg-surface-2/60 px-2.5 py-2">
                    <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', LEVELS[c.level].dot)} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-bold text-brand uppercase">
                        {names[c.discipline] ?? c.discipline} · {KIND[c.level]}
                        {c.priority >= 3 && <Flame className="ml-1 inline size-3 text-orange-500" />}
                      </span>
                      <span className="block text-[13px] leading-snug text-ink">{c.title}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted">{free ? 'Livre' : 'Dia de descanso'}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
