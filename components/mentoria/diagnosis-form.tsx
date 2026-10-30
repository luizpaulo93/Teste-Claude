'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from '@/components/toast';
import { buttonClass, Field, Input } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import { saveDiagnosis } from '@/app/(app)/mentoria/actions';
import { fmtMinutes, levelOf, SUBJECTS, WEEKDAYS } from '@/lib/mentoria';
import type { Mentoria } from '@/lib/types';
import { cn } from '@/lib/utils';

const LEVELS = ['', 'Muito fraco', 'Fraco', 'Médio', 'Bom', 'Forte'];

/** Diagnóstico: objetivo, data da prova, horas livres por dia e nível em cada matéria. Base do cronograma automático. */
export function DiagnosisForm({ mentoria, mentoriaId, next }: { mentoria: Mentoria; mentoriaId?: string; next?: string }) {
  const router = useRouter();
  const [course, setCourse] = useState(mentoria.target_course || mentoria.exam_target || '');
  const [score, setScore] = useState(mentoria.target_score ? String(mentoria.target_score) : '');
  const [exam, setExam] = useState(mentoria.exam_date ?? '');
  const [avail, setAvail] = useState<number[]>(mentoria.availability?.length === 7 ? mentoria.availability : [120, 120, 120, 120, 120, 60, 0]);
  const [levels, setLevels] = useState<Record<string, number>>(() => Object.fromEntries(SUBJECTS.map((s) => [s, levelOf(mentoria, s)])));
  const [busy, setBusy] = useState(false);
  const total = avail.reduce((a, b) => a + b, 0);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await saveDiagnosis({ target_course: course, target_score: Number(score) || 0, exam_date: exam, availability: avail, levels }, mentoriaId);
    setBusy(false);
    if (r.error) return toast.error(r.error);
    toast('Diagnóstico salvo');
    if (next) router.push(next);
    else router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Curso / objetivo">
          <Input value={course} onChange={(e) => setCourse(e.target.value)} maxLength={120} placeholder="Ex.: Medicina UFPA" />
        </Field>
        <Field label="Nota que você precisa">
          <Input value={score} onChange={(e) => setScore(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="Ex.: 780" />
        </Field>
        <Field label="Data da prova">
          <Input type="date" value={exam} onChange={(e) => setExam(e.target.value)} />
        </Field>
      </div>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-bold text-ink">Tempo livre para estudar</p>
          <p className="text-xs text-muted">{fmtMinutes(total)} por semana</p>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((d, i) => (
            <label key={d} className="flex flex-col items-center gap-1 rounded-xl border border-line bg-surface-2/60 p-1.5">
              <span className="text-[11px] font-bold text-ink-2">{d}</span>
              <select
                value={avail[i]}
                onChange={(e) => setAvail((a) => a.map((v, k) => (k === i ? Number(e.target.value) : v)))}
                className="w-full appearance-none rounded-md bg-transparent text-center text-xs font-semibold text-ink outline-none"
                aria-label={`Horas ${d}`}
              >
                {[0, 30, 60, 90, 120, 150, 180, 240, 300, 360, 420, 480].map((m) => (
                  <option key={m} value={m}>
                    {m ? fmtMinutes(m) : '—'}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-bold text-ink">Como você está em cada matéria?</p>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {SUBJECTS.map((s) => (
            <li key={s} className="flex flex-col gap-2 px-3.5 py-2.5 sm:flex-row sm:items-center">
              <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{s}</span>
              <div className="grid grid-cols-5 gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    title={LEVELS[n]}
                    onClick={() => setLevels((l) => ({ ...l, [s]: n }))}
                    className={cn(
                      'h-8 rounded-lg border text-xs font-bold transition sm:w-10',
                      levels[s] === n ? (n <= 2 ? 'border-danger bg-danger/15 text-danger' : n === 3 ? 'border-warning bg-warning/15 text-warning' : 'border-success bg-success/15 text-success') : 'border-line text-muted',
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-muted">1 = muito fraco · 5 = forte. As matérias mais fracas ganham mais tempo no cronograma.</p>
      </section>

      <div className="flex justify-end">
        <button type="submit" disabled={busy} className={buttonClass('primary', 'lg')}>
          {busy && <Spinner />} Salvar diagnóstico
        </button>
      </div>
    </form>
  );
}
