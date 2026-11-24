'use client';

import { Copy, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from '@/components/toast';
import { buttonClass } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import { saveSchedule } from '@/app/(app)/mentoria/actions';
import { fromMinutes, PERIOD_PRESETS, periodName, toMinutes, WEEKDAYS, windowMinutes, type StudyWindow } from '@/lib/mentoria';
import { cn } from '@/lib/utils';

const FULL = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
export const fmtMin = (m: number) => (m ? (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}` : `${m} min`) : '—');

/**
 * Períodos de estudo de cada dia (manhã, tarde, noite ou o horário que quiser).
 * O aluno muda quando quiser: o cronograma se reorganiza na hora, com o que atrasou na frente.
 */
export function ScheduleForm({ windows, mentoriaId, next }: { windows: StudyWindow[][]; mentoriaId?: string; next?: string }) {
  const router = useRouter();
  const [days, setDays] = useState<StudyWindow[][]>(() => Array.from({ length: 7 }, (_, i) => (windows[i] ?? []).map((w) => [w[0], w[1]] as StudyWindow)));
  const [busy, setBusy] = useState(false);
  const total = days.reduce((a, d) => a + windowMinutes(d), 0);

  const setDay = (i: number, f: (d: StudyWindow[]) => StudyWindow[]) => setDays((all) => all.map((d, k) => (k === i ? f(d) : d)));
  const add = (i: number, from: string, to: string) =>
    setDay(i, (d) => {
      // período já ocupado: põe logo depois do último
      if (d.some((w) => toMinutes(w[0]) < toMinutes(to) && toMinutes(from) < toMinutes(w[1]))) {
        const end = Math.max(...d.map((w) => toMinutes(w[1])));
        if (end >= 23 * 60) return d;
        return [...d, [fromMinutes(end), fromMinutes(Math.min(end + 60, 23 * 60 + 59))]];
      }
      return [...d, [from, to]].sort((a, b) => toMinutes(a[0]) - toMinutes(b[0])) as StudyWindow[];
    });
  const edit = (i: number, j: number, k: 0 | 1, v: string) => setDay(i, (d) => d.map((w, x) => (x === j ? ((k ? [w[0], v] : [v, w[1]]) as StudyWindow) : w)));
  const remove = (i: number, j: number) => setDay(i, (d) => d.filter((_, x) => x !== j));
  const copyToWeekdays = (i: number) => setDays((all) => all.map((d, k) => (k < 5 ? days[i].map((w) => [w[0], w[1]] as StudyWindow) : d)));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const bad = days.some((d) => d.some((w) => toMinutes(w[1]) <= toMinutes(w[0])));
    if (bad) return toast.error('Algum período termina antes de começar.');
    setBusy(true);
    const r = await saveSchedule({ windows: days }, mentoriaId).catch(() => ({ error: 'Sem conexão.' }));
    setBusy(false);
    if (r.error) return toast.error(r.error);
    toast('Horários salvos. A semana foi replanejada (o que atrasou vem primeiro).');
    if (next) router.push(next);
    else router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-ink">Quando você pode estudar?</p>
        <p className="num shrink-0 text-xs text-muted">{fmtMin(total)} por semana</p>
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {days.map((d, i) => {
          const mins = windowMinutes(d);
          return (
            <li key={FULL[i]} className={cn('space-y-2.5 p-3.5', !d.length && 'bg-surface-2/40')}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">
                  <span className="sm:hidden">{WEEKDAYS[i]}</span>
                  <span className="hidden sm:inline">{FULL[i]}</span>
                  <span className="num ml-2 text-xs font-normal text-muted">{d.length ? fmtMin(mins) : 'sem estudo'}</span>
                </p>
                {d.length > 0 && i < 5 && (
                  <button type="button" onClick={() => copyToWeekdays(i)} className="flex items-center gap-1 text-[11px] font-medium text-muted hover:text-ink">
                    <Copy className="size-3" /> Repetir de seg a sex
                  </button>
                )}
              </div>
              {d.map((w, j) => (
                <div key={j} className="flex items-center gap-2">
                  <span className="w-12 shrink-0 font-mono text-[10.5px] tracking-[0.04em] text-muted uppercase">{periodName(w[0])}</span>
                  <input
                    type="time"
                    value={w[0]}
                    onChange={(e) => edit(i, j, 0, e.target.value)}
                    aria-label={`Início ${FULL[i]}`}
                    className="num h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2 text-sm text-ink sm:max-w-40"
                  />
                  <span className="text-xs text-muted">às</span>
                  <input
                    type="time"
                    value={w[1]}
                    onChange={(e) => edit(i, j, 1, e.target.value)}
                    aria-label={`Fim ${FULL[i]}`}
                    className="num h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2 text-sm text-ink sm:max-w-40"
                  />
                  <button type="button" onClick={() => remove(i, j)} aria-label="Tirar período" className={buttonClass('ghost', 'icon', 'size-9 shrink-0 text-muted')}>
                    <X className="size-4" />
                  </button>
                </div>
              ))}
              {d.length < 4 && (
                <div className="flex flex-wrap gap-1.5">
                  {PERIOD_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => add(i, p.from, p.to)}
                      className="flex h-7 items-center gap-1 rounded-md border border-line px-2 text-[11.5px] font-medium text-ink-2 hover:bg-surface-2"
                    >
                      <Plus className="size-3" /> {p.label}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-muted">Assunto novo: 1h · lista ou revisão: 30 min. Pode mudar quando quiser.</p>
      <button type="submit" disabled={busy} className={buttonClass('primary', 'lg', 'w-full sm:w-auto')}>
        {busy && <Spinner />} Salvar e replanejar
      </button>
    </form>
  );
}
