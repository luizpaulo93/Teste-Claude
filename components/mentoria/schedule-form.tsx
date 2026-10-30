'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from '@/components/toast';
import { buttonClass, Field, Input } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import { saveSchedule } from '@/app/(app)/mentoria/actions';
import { WEEKDAYS } from '@/lib/mentoria';

const OPTIONS = [0, 30, 60, 90, 120, 150, 180, 240, 300, 360, 420, 480];
const fmt = (m: number) => (m ? (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? '30' : ''}` : `${m} min`) : '—');

/** Horários livres para estudar em cada dia da semana (base do cronograma). */
export function ScheduleForm({ availability, examDate, mentoriaId, next }: { availability: number[]; examDate: string | null; mentoriaId?: string; next?: string }) {
  const router = useRouter();
  const [avail, setAvail] = useState<number[]>(availability.length === 7 ? availability : [120, 120, 120, 120, 120, 60, 0]);
  const [exam, setExam] = useState(examDate ?? '');
  const [busy, setBusy] = useState(false);
  const total = avail.reduce((a, b) => a + b, 0);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await saveSchedule({ availability: avail, exam_date: exam }, mentoriaId);
    setBusy(false);
    if (r.error) return toast.error(r.error);
    toast('Horários salvos. O cronograma foi ajustado.');
    if (next) router.push(next);
    else router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-bold text-ink">Quanto tempo você tem para estudar em cada dia?</p>
          <p className="shrink-0 text-xs text-muted">{fmt(total)} por semana</p>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((d, i) => (
            <label key={d} className="flex flex-col items-center gap-1 rounded-xl border border-line bg-surface-2/60 p-1.5">
              <span className="text-[11px] font-bold text-ink-2">{d}</span>
              <select
                value={avail[i]}
                onChange={(e) => setAvail((a) => a.map((v, k) => (k === i ? Number(e.target.value) : v)))}
                className="w-full appearance-none bg-transparent text-center text-xs font-semibold text-ink outline-none"
                aria-label={`Tempo ${d}`}
              >
                {OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {fmt(m)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <p className="text-[11px] text-muted">Cada assunto novo ocupa 1h (estudar + questões) e cada revisão, 30 min.</p>
      </div>
      <Field label="Data da prova (opcional)">
        <Input type="date" value={exam} onChange={(e) => setExam(e.target.value)} className="sm:max-w-xs" />
      </Field>
      <button type="submit" disabled={busy} className={buttonClass('primary', 'lg', 'w-full sm:w-auto')}>
        {busy && <Spinner />} Salvar horários
      </button>
    </form>
  );
}
