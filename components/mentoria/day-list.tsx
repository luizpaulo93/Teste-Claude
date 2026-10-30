'use client';

import { ArrowRight, CalendarRange, Check, ChevronLeft, ChevronRight, Flame, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from '@/components/toast';
import { buttonClass, Input } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import { DayFolder, periodLabel, type ApostilaGroup } from '@/components/mentoria/apostilas';
import { moveCard, removeFromDay, scoreCard } from '@/app/(app)/mentoria/actions';
import { FEELS, GOAL, LEVELS, TASK_KIND, WEEKDAYS } from '@/lib/mentoria';
import { cn, formatDate } from '@/lib/utils';

export interface DayItem {
  id: string;
  discipline: string;
  title: string;
  priority: number;
  /** nível no momento (0 novo … 4 manutenção) */
  level: number;
  step: 'study' | 'questions';
  /** acrescentado pelo aluno (além do que o mentor montou) */
  extra?: boolean;
  /** assunto de um período escolhido pelo mentor */
  period?: { from: string; to: string } | null;
  /** já feito neste dia: resultado */
  result?: { q: number; c: number; acc: number; passed: boolean; goal: number; f?: number } | null;
}

/** Cronograma por dia da semana: escolhe o dia e vê os assuntos; hoje dá para marcar estudado e as questões. */
export function DayList({
  week,
  day,
  today,
  items,
  minutes,
  free,
  mentoriaId,
  folder = [],
}: {
  week: string[]; // 7 datas (seg..dom)
  day: string;
  today: string;
  items: DayItem[];
  minutes: number;
  free: number;
  mentoriaId?: string;
  /** apostilas dos períodos que valem neste dia */
  folder?: ApostilaGroup[];
}) {
  const path = usePathname();
  const href = (d: string) => `${path}?d=${d}`;
  const prev = week[0] ? shiftISO(week[0], -7) : day;
  const next = week[0] ? shiftISO(week[0], 7) : day;
  const editable = day <= today;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        <Link href={href(prev)} scroll={false} className={buttonClass('ghost', 'icon', 'size-9 shrink-0')} aria-label="Semana anterior">
          <ChevronLeft className="size-4" />
        </Link>
        <div className="grid flex-1 grid-cols-7 gap-1">
          {week.map((d, i) => (
            <Link
              key={d}
              href={href(d)}
              scroll={false}
              className={cn(
                'flex flex-col items-center rounded-xl border py-1.5 transition',
                d === day ? 'border-brand bg-brand text-white' : d === today ? 'border-brand/50 text-ink' : 'border-line text-ink-2 hover:bg-surface-2',
              )}
            >
              <span className="text-[10px] font-bold uppercase">{WEEKDAYS[i]}</span>
              <span className="text-sm font-extrabold tabular-nums">{Number(d.slice(8))}</span>
            </Link>
          ))}
        </div>
        <Link href={href(next)} scroll={false} className={buttonClass('ghost', 'icon', 'size-9 shrink-0')} aria-label="Próxima semana">
          <ChevronRight className="size-4" />
        </Link>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-bold text-ink">
          {day === today ? 'Hoje' : WEEKDAYS[week.indexOf(day)] ?? ''} · {formatDate(day)}
        </p>
        <p className="text-[11px] text-muted tabular-nums">{free ? `${fmt(minutes)} de ${fmt(free)} livres` : day < today ? '' : 'sem estudo neste dia'}</p>
      </div>

      <DayFolder groups={folder} />

      {items.length ? (
        <ul className="space-y-2">
          {items.map((it) => (
            <Row key={it.id} it={it} editable={editable && !it.result} removable={day >= today && !it.result} mentoriaId={mentoriaId} />
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-sm text-muted">
          {day < today ? 'Nada estudado neste dia.' : free ? 'Nenhum assunto neste dia.' : 'Dia de descanso.'}
        </p>
      )}
    </div>
  );
}

function Row({ it, editable, removable, mentoriaId }: { it: DayItem; editable: boolean; removable: boolean; mentoriaId?: string }) {
  const router = useRouter();
  const [step, setStep] = useState(it.step);
  const [q, setQ] = useState('');
  const [c, setC] = useState('');
  const [busy, setBusy] = useState(false);
  const [feel, setFeel] = useState(0);
  const goal = GOAL[Math.min(4, it.level)];
  const total = Number(q) || 0;
  const right = Math.min(total, Number(c) || 0);

  async function remove() {
    setBusy(true);
    const r = await removeFromDay(it.id, mentoriaId).catch(() => ({ error: 'rede' }));
    setBusy(false);
    if (r.error) return toast.error('Não foi possível tirar.');
    toast('Assunto tirado do dia.');
    router.refresh();
  }
  async function studied() {
    setStep('questions');
    const r = await moveCard(it.id, 'questions', mentoriaId).catch(() => ({ error: 'rede' }));
    if (r.error) {
      setStep('study');
      toast.error('Não foi possível salvar.');
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!total || c === '') return toast.error('Preencha quantas questões fez e quantas acertou.');
    if (!feel) return toast.error('Conte como foi: de boas, mais ou menos ou ladeira abaixo.');
    setBusy(true);
    const r = await scoreCard(it.id, total, right, feel, mentoriaId);
    setBusy(false);
    if (r.error) return toast.error(r.error);
    toast(r.passed ? `${r.acc}% de acerto${r.goal ? ' — meta batida!' : ''} Próxima vez em ${formatDate(r.due!)}` : `${r.acc}% — meta de ${r.goal}% não batida. Volta em ${formatDate(r.due!)}`);
    router.refresh();
  }

  const lv = LEVELS[Math.min(4, it.level)];
  return (
    <li className={cn('rounded-2xl border bg-surface p-3.5', it.result ? (it.result.passed ? 'border-success/40' : 'border-danger/40') : 'border-line')}>
      <div className="flex items-start gap-3">
        <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', lv.dot)} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-brand uppercase">
            {it.discipline} · {TASK_KIND[Math.min(4, it.level)]}
            {it.priority >= 3 && (
              <span className="flex items-center gap-0.5 normal-case text-orange-500">
                <Flame className="size-3" /> mais cobrado
              </span>
            )}
            {it.period && (
              <span className="flex items-center gap-0.5 rounded-md bg-sky-500/15 px-1.5 py-0.5 normal-case text-sky-500">
                <CalendarRange className="size-3" /> período {periodLabel(it.period.from, it.period.to)}
              </span>
            )}
            {it.extra && (
              <span className="flex items-center gap-0.5 rounded-md bg-violet-500/15 px-1.5 py-0.5 normal-case text-violet-500">
                <Plus className="size-3" /> {mentoriaId ? 'acrescentado pelo aluno' : 'você acrescentou'}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-[15px] leading-snug font-semibold text-ink">{it.title}</p>
          {it.result ? (
            <p className={cn('mt-1.5 flex items-center gap-1 text-xs font-semibold', it.result.passed ? 'text-success' : 'text-danger')}>
              {it.result.passed ? <Check className="size-3.5" /> : <X className="size-3.5" />}
              {it.result.c}/{it.result.q} · {it.result.acc}% {it.result.goal ? `(meta ${it.result.goal}%)` : ''}
              {it.result.f ? <span className="ml-1 font-normal text-muted">· {FEELS[it.result.f - 1].emoji} {FEELS[it.result.f - 1].label}</span> : null}
            </p>
          ) : (
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className={cn('rounded-md px-1.5 py-0.5 font-bold', step === 'questions' ? 'bg-amber-400/15 text-amber-500' : 'bg-surface-3 text-muted')}>
                {step === 'questions' ? 'Estudado' : 'A estudar'}
              </span>
              {goal > 0 && <span className="text-muted">meta {goal}% de acerto</span>}
            </p>
          )}
        </div>
        {it.extra && removable && step === 'study' && (
          <button type="button" onClick={remove} disabled={busy} aria-label="Tirar do dia" title="Tirar do dia" className={buttonClass('ghost', 'icon', 'size-10 shrink-0 text-muted')}>
            <X className="size-4" />
          </button>
        )}
        {editable && step === 'study' && (
          <button
            type="button"
            onClick={studied}
            aria-label="Marcar como estudado"
            title="Estudado"
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand transition hover:bg-brand hover:text-white"
          >
            <ArrowRight className="size-5" />
          </button>
        )}
      </div>
      {editable && step === 'questions' && (
        <form onSubmit={save} className="mt-3 space-y-2 border-t border-line pt-3">
          <p className="text-xs font-semibold text-ink-2">Questões resolvidas</p>
          <div className="grid grid-cols-2 gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric" placeholder="Feitas" aria-label="Questões feitas" className="h-10" />
            <Input value={c} onChange={(e) => setC(e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric" placeholder="Acertos" aria-label="Acertos" className="h-10" />
          </div>
          <p className="pt-1 text-xs font-semibold text-ink-2">Como foi esse assunto?</p>
          <div className="grid grid-cols-3 gap-1.5">
            {FEELS.map((x) => (
              <button
                key={x.value}
                type="button"
                onClick={() => setFeel(x.value)}
                aria-pressed={feel === x.value}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2 text-[11px] font-semibold transition',
                  feel === x.value ? (x.value === 3 ? 'border-danger bg-danger/10 text-danger' : x.value === 2 ? 'border-warning bg-warning/10 text-warning' : 'border-success bg-success/10 text-success') : 'border-line text-ink-2',
                )}
              >
                <span className="text-lg leading-none">{x.emoji}</span>
                {x.label}
              </button>
            ))}
          </div>
          <button type="submit" disabled={busy} className={buttonClass('primary', 'md', 'w-full')}>
            {busy ? <Spinner /> : 'Salvar'}
          </button>
          {total > 0 && (
            <p className={cn('text-xs font-semibold', Math.round((right / total) * 100) >= goal ? 'text-success' : 'text-danger')}>
              Taxa de acerto: {Math.round((right / total) * 100)}%{goal ? ` · meta ${goal}%` : ''}
            </p>
          )}
        </form>
      )}
    </li>
  );
}

const fmt = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}` : `${m} min`);
function shiftISO(date: string, days: number) {
  const t = new Date(`${date}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}
