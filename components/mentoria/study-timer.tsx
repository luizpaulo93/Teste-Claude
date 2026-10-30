'use client';

import { Pause, Play, Square, Timer } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from '@/components/toast';
import { buttonClass, Select } from '@/components/ui';
import { logSession } from '@/app/(app)/mentoria/actions';
import { SUBJECTS } from '@/lib/mentoria';
import { cn } from '@/lib/utils';

const MODES = { p25: { label: 'Foco 25 min', sec: 25 * 60 }, p50: { label: 'Foco 50 min', sec: 50 * 60 }, free: { label: 'Livre', sec: 0 } } as const;
type Mode = keyof typeof MODES;
const KEY = 'vertice_timer';

interface Saved {
  mode: Mode;
  subject: string;
  /** segundos já contados antes do último play */
  acc: number;
  /** quando deu play (ms) — vazio se pausado */
  since: number | null;
}

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/** Cronômetro de estudo (Pomodoro ou livre). Ao terminar, registra o tempo na matéria. Continua contando se trocar de página. */
export function StudyTimer({ defaultSubject }: { defaultSubject?: string }) {
  const router = useRouter();
  const [s, setS] = useState<Saved>({ mode: 'p25', subject: defaultSubject ?? SUBJECTS[0], acc: 0, since: null });
  const [now, setNow] = useState(() => Date.now());
  const saving = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setS(JSON.parse(raw));
    } catch {
      /* sem armazenamento */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* sem armazenamento */
    }
  }, [s]);
  useEffect(() => {
    if (!s.since) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [s.since]);

  const elapsed = s.acc + (s.since ? Math.floor((now - s.since) / 1000) : 0);
  const goal = MODES[s.mode].sec;
  const shown = goal ? Math.max(0, goal - elapsed) : elapsed;

  async function finish(auto = false) {
    if (saving.current) return;
    const minutes = Math.round(elapsed / 60);
    setS((v) => ({ ...v, acc: 0, since: null }));
    if (minutes < 1) return;
    saving.current = true;
    const r = await logSession({ subject: s.subject, minutes, questions: 0, correct: 0 });
    saving.current = false;
    if (r.error) toast.error(r.error);
    else {
      toast(auto ? `Ciclo concluído: ${minutes} min de ${s.subject}. Faça uma pausa!` : `${minutes} min de ${s.subject} registrados`);
      router.refresh();
    }
  }

  // Pomodoro terminou
  useEffect(() => {
    if (goal && s.since && elapsed >= goal) {
      try {
        const ctx = new AudioContext();
        const o = ctx.createOscillator();
        o.frequency.value = 880;
        o.connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.4);
        navigator.vibrate?.([200, 100, 200]);
      } catch {
        /* sem som */
      }
      void finish(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, goal]);

  const running = Boolean(s.since);
  const progress = goal ? Math.min(1, elapsed / goal) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Timer className="size-4 text-brand" />
        <p className="text-sm font-bold text-ink">Cronômetro de estudo</p>
      </div>
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface-2/60 p-1 text-xs font-semibold">
        {(Object.keys(MODES) as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            disabled={running || elapsed > 0}
            onClick={() => setS((v) => ({ ...v, mode: m }))}
            className={cn('rounded-lg py-1.5 transition disabled:opacity-60', s.mode === m ? 'bg-brand text-white' : 'text-ink-2')}
          >
            {MODES[m].label}
          </button>
        ))}
      </div>
      <Select value={s.subject} onChange={(e) => setS((v) => ({ ...v, subject: e.target.value }))} disabled={running} aria-label="Matéria">
        {SUBJECTS.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </Select>
      <div className="relative grid place-items-center py-2">
        <svg viewBox="0 0 120 120" className="size-40 -rotate-90">
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--surface-3)" strokeWidth="8" />
          {goal > 0 && (
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--brand)" strokeWidth="8" strokeLinecap="round" strokeDasharray={2 * Math.PI * 52} strokeDashoffset={2 * Math.PI * 52 * (1 - progress)} />
          )}
        </svg>
        <span className="absolute text-3xl font-extrabold text-ink tabular-nums">{fmt(shown)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {running ? (
          <button type="button" onClick={() => setS((v) => ({ ...v, acc: elapsed, since: null }))} className={buttonClass('secondary', 'md')}>
            <Pause className="size-4" /> Pausar
          </button>
        ) : (
          <button type="button" onClick={() => setS((v) => ({ ...v, since: Date.now() }))} className={buttonClass('primary', 'md')}>
            <Play className="size-4" /> {elapsed ? 'Continuar' : 'Começar'}
          </button>
        )}
        <button type="button" onClick={() => finish()} disabled={elapsed < 60} className={buttonClass('secondary', 'md')}>
          <Square className="size-4" /> Encerrar e salvar
        </button>
      </div>
    </div>
  );
}
