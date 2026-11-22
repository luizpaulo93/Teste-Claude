'use client';

import { ArrowRight, BookOpen, CalendarRange, Check, ChevronLeft, ChevronRight, Flame, ListChecks, Plus, RotateCcw, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from '@/components/toast';
import { buttonClass } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import { DayFolder, periodLabel, type ApostilaGroup } from '@/components/mentoria/apostilas';
import { removeFromDay, setListSize, studiedTheory } from '@/app/(app)/mentoria/actions';
import { LEVELS, WEEKDAYS } from '@/lib/mentoria';
import { cn, formatDate } from '@/lib/utils';

export interface DayItem {
  id: string;
  kind: 'theory' | 'list' | 'review';
  discipline: string;
  title: string;
  priority: number;
  /** etapa na trilha (0 teoria, 1 a 3 níveis, 4 dominado) */
  level: number;
  /** tamanho escolhido para as listas do assunto */
  size: number;
  hard: boolean;
  retained: number;
  /** lista aberta (para responder) */
  list: { id: string; answered: number; total: number; round: number } | null;
  /** acrescentado pelo aluno (além do que o mentor montou) */
  extra?: boolean;
  /** assunto de um período escolhido pelo mentor */
  period?: { from: string; to: string } | null;
  /** já feito neste dia: resultado da lista */
  result?: { q: number; c: number; acc: number; passed: boolean; round: number } | null;
}

/** Agenda por dia da semana: teoria para estudar, listas dos níveis e revisões. */
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
                'flex flex-col items-center rounded-lg border py-1.5 transition',
                d === day ? 'border-ink bg-ink text-bg' : d === today ? 'border-brand/50 text-ink' : 'border-line text-ink-2 hover:bg-surface-2',
              )}
            >
              <span className="font-mono text-[10px] uppercase">{WEEKDAYS[i]}</span>
              <span className="num text-sm font-medium">{Number(d.slice(8))}</span>
            </Link>
          ))}
        </div>
        <Link href={href(next)} scroll={false} className={buttonClass('ghost', 'icon', 'size-9 shrink-0')} aria-label="Próxima semana">
          <ChevronRight className="size-4" />
        </Link>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-ink">
          {day === today ? 'Hoje' : (WEEKDAYS[week.indexOf(day)] ?? '')} · {formatDate(day)}
        </p>
        <p className="num text-[11px] text-muted">{free ? `${fmt(minutes)} de ${fmt(free)} livres` : day < today ? '' : 'sem estudo neste dia'}</p>
      </div>

      <DayFolder groups={folder} />

      {items.length ? (
        <ul className="space-y-2">
          {items.map((it) => (
            <Row key={it.id} it={it} editable={editable && !it.result} removable={day >= today && !it.result} mentoriaId={mentoriaId} />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-line-strong p-8 text-center text-sm text-muted">
          {day < today ? 'Nada feito neste dia.' : free ? 'Nenhum assunto neste dia.' : 'Dia de descanso.'}
        </p>
      )}
    </div>
  );
}

function Row({ it, editable, removable, mentoriaId }: { it: DayItem; editable: boolean; removable: boolean; mentoriaId?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const lv = LEVELS[Math.min(4, it.level)];

  async function remove() {
    setBusy(true);
    const r = await removeFromDay(it.id, mentoriaId).catch(() => ({ error: 'rede' }));
    setBusy(false);
    if (r.error) return toast.error('Não foi possível tirar.');
    toast('Assunto tirado do dia.');
    router.refresh();
  }
  async function theoryDone() {
    setBusy(true);
    const r = await studiedTheory(it.id, mentoriaId).catch(() => ({ error: 'Sem conexão.' }) as { error: string; listId?: string; noQuestions?: boolean });
    setBusy(false);
    if (r.error) return toast.error(r.error);
    if ('noQuestions' in r && r.noQuestions) toast('Teoria concluída. Ainda não há questões deste assunto no banco: o mentor foi avisado.');
    else toast('Teoria concluída! A lista do Nível 1 está pronta.');
    router.refresh();
  }

  const label = it.kind === 'review' ? 'Revisão' : it.kind === 'theory' ? 'Teoria' : lv.label;
  return (
    <li
      className={cn(
        'rounded-xl border bg-surface p-3.5',
        it.result ? (it.result.passed ? 'border-success/40' : 'border-danger/40') : it.kind === 'review' ? 'border-brand/35' : 'border-line',
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', it.kind === 'review' ? 'bg-brand' : lv.dot)} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[10.5px] tracking-[0.04em] text-muted uppercase">
            {it.discipline} · {label}
            {it.priority >= 3 && it.kind !== 'review' && (
              <span className="flex items-center gap-0.5 text-orange-500 normal-case">
                <Flame className="size-3" /> mais cobrado
              </span>
            )}
            {it.hard && !it.result && <span className="rounded bg-danger/10 px-1 py-px text-danger normal-case">reforço</span>}
            {it.period && (
              <span className="flex items-center gap-0.5 rounded bg-sky-500/12 px-1 py-px text-sky-500 normal-case">
                <CalendarRange className="size-3" /> {periodLabel(it.period.from, it.period.to)}
              </span>
            )}
            {it.extra && (
              <span className="flex items-center gap-0.5 rounded bg-surface-3 px-1 py-px text-ink-2 normal-case">
                <Plus className="size-3" /> {mentoriaId ? 'acrescentado pelo aluno' : 'você acrescentou'}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-[15px] leading-snug font-semibold text-ink">{it.title}</p>

          {it.result ? (
            <p className={cn('mt-1.5 flex flex-wrap items-center gap-1 text-xs font-medium', it.result.passed ? 'text-success' : 'text-danger')}>
              {it.result.passed ? <Check className="size-3.5" /> : <X className="size-3.5" />}
              <span className="num">
                {it.result.c}/{it.result.q}
              </span>
              {it.level >= 1 && it.level <= 3
                ? it.result.passed
                  ? `· passou do ${LEVELS[it.level].label}`
                  : `· ficou no ${LEVELS[it.level].label}, nova lista criada`
                : ''}
            </p>
          ) : it.kind === 'theory' ? (
            <p className="mt-1 text-xs text-muted">Estude a teoria. Ao terminar, a lista do Nível 1 (questões básicas) é criada.</p>
          ) : it.list ? (
            <ListLine it={it} editable={editable} mentoriaId={mentoriaId} />
          ) : (
            <p className="mt-1 text-xs text-warning">Ainda não há questões deste nível no banco. O mentor foi avisado.</p>
          )}
        </div>
        {it.extra && removable && it.kind === 'theory' && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            aria-label="Tirar do dia"
            title="Tirar do dia"
            className={buttonClass('ghost', 'icon', 'size-10 shrink-0 text-muted')}
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      {editable && it.kind === 'theory' && (
        <button type="button" onClick={theoryDone} disabled={busy} className={buttonClass('secondary', 'md', 'mt-3 w-full')}>
          {busy ? <Spinner /> : <BookOpen className="size-4" />} Terminei a teoria
        </button>
      )}
    </li>
  );
}

/** Lista aberta: progresso, botão para responder e (antes de começar) o tamanho da lista. */
function ListLine({ it, editable, mentoriaId }: { it: DayItem; editable: boolean; mentoriaId?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(0);
  const l = it.list!;
  const started = l.answered > 0;
  async function size(n: number) {
    if (n === it.size) return;
    setBusy(n);
    const r = await setListSize(it.id, n, mentoriaId).catch(() => ({ error: 'Sem conexão.' }));
    setBusy(0);
    if (r.error) return toast.error(r.error);
    toast(`Listas deste assunto com ${n} questões.`);
    router.refresh();
  }
  return (
    <div className="mt-2 space-y-2.5">
      <div className="flex items-center gap-2.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round((l.answered / Math.max(1, l.total)) * 100)}%` }} />
        </div>
        <span className="num shrink-0 text-[11px] text-muted">
          {l.answered}/{l.total}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/listas/${l.id}`} className={buttonClass('primary', 'sm')}>
          <ListChecks className="size-3.5" /> {started ? 'Continuar lista' : 'Fazer lista'} <ArrowRight className="size-3.5" />
        </Link>
        {l.round > 1 && (
          <span className="flex items-center gap-1 text-[11px] text-muted">
            <RotateCcw className="size-3" /> {l.round}ª lista deste nível
          </span>
        )}
        {it.kind === 'list' && editable && !started && (
          <span className="ml-auto inline-flex items-center rounded-md border border-line p-0.5" role="group" aria-label="Questões por lista">
            {[5, 10, 15].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => size(n)}
                aria-pressed={it.size === n}
                className={cn('num h-7 min-w-8 rounded px-1.5 text-[11px] font-medium', it.size === n ? 'bg-ink text-bg' : 'text-ink-2 hover:bg-surface-2')}
              >
                {busy === n ? <Spinner className="size-3" /> : n}
              </button>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

const fmt = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}` : `${m} min`);
function shiftISO(date: string, days: number) {
  const t = new Date(`${date}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}
