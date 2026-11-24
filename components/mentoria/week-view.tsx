import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { disciplineHue, discStyle } from '@/lib/discipline-colors';
import { WEEKDAYS } from '@/lib/mentoria';
import type { WeekSession } from '@/lib/mentoria-data';
import { cn } from '@/lib/utils';

const fmt = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}` : `${m}min`);
const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const shiftISO = (date: string, days: number) => {
  const t = new Date(`${date}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
};

interface Props {
  today: string;
  monday: string;
  week: string[];
  selected: string;
  days: { date: string; free: number; sessions: WeekSession[]; lateDay: boolean }[];
  summary: { planned: number; free: number; sessions: number; disciplines: number; reviews: number; done: number; late: number };
  /** onde ficam os horários (aluno ou mentor) */
  hoursHref: string;
}

/** Resumo da semana: tempo planejado, sessões, disciplinas, listas e revisões, atrasados. */
export function WeekSummary({ summary, monday, today, hoursHref }: Pick<Props, 'summary' | 'monday' | 'today' | 'hoursHref'>) {
  const s = summary;
  const current = monday <= today && today <= shiftISO(monday, 6);
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 pt-3.5">
        <p className="flex items-center gap-1.5 font-mono text-[10.5px] font-medium tracking-[0.08em] text-muted uppercase">
          <CalendarDays className="size-3.5" /> {current ? 'Sua semana' : `Semana de ${dm(monday)}`}
        </p>
        {s.late > 0 && (
          <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-danger">
            <span className="size-1.5 rounded-full bg-danger" /> {s.late} atrasado{s.late === 1 ? '' : 's'} · entram primeiro
          </p>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3.5 sm:grid-cols-4">
        <Stat label="planejadas" value={fmt(s.planned)} hint={s.free ? `de ${fmt(s.free)} livres` : undefined} />
        <Stat label="sessões" value={String(s.sessions)} hint={s.done ? `${s.done} feitas` : undefined} />
        <Stat label="disciplinas" value={String(s.disciplines)} />
        <Stat label="listas e revisões" value={fmt(s.reviews)} />
      </dl>
      <div className="flex justify-end border-t border-line px-4 py-2.5">
        <Link href={hoursHref} className="flex items-center gap-1.5 text-[12.5px] font-medium text-brand hover:underline">
          <RefreshCw className="size-3.5" /> Mudar horários e replanejar
        </Link>
      </div>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <dd className="num text-lg font-semibold tracking-tight text-ink">{value}</dd>
      <dt className="truncate text-[11.5px] text-muted">
        {label}
        {hint && <span className="text-muted/80"> · {hint}</span>}
      </dt>
    </div>
  );
}

/** Grade da semana (seg a dom): cada sessão na cor da disciplina; o que atrasou aparece riscado e vai para frente. */
export function WeekGrid({ today, week, selected, days, basePath }: Pick<Props, 'today' | 'week' | 'selected' | 'days'> & { basePath: string }) {
  const href = (d: string) => `${basePath}?v=semana&d=${d}`;
  const disciplines = new Map<string, string>();
  for (const d of days) for (const s of d.sessions) if (s.kind !== 'review') disciplines.set(s.discipline, s.disciplineName);
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-1.5">
        <Link href={href(shiftISO(week[0], -7))} scroll={false} className="flex h-9 flex-1 items-center justify-center gap-1 rounded-lg border border-line text-[12.5px] font-medium text-ink-2 hover:bg-surface-2">
          <ChevronLeft className="size-4" /> <span className="hidden sm:inline">Semana</span> anterior
        </Link>
        <Link
          href={href(today)}
          scroll={false}
          className={cn(
            'flex h-9 flex-1 items-center justify-center rounded-lg border text-[12.5px] font-medium',
            week.includes(today) ? 'border-brand/40 bg-brand-soft text-ink' : 'border-line text-ink-2 hover:bg-surface-2',
          )}
        >
          Semana atual
        </Link>
        <Link href={href(shiftISO(week[0], 7))} scroll={false} className="flex h-9 flex-1 items-center justify-center gap-1 rounded-lg border border-line text-[12.5px] font-medium text-ink-2 hover:bg-surface-2">
          Próxima <span className="hidden sm:inline">semana</span> <ChevronRight className="size-4" />
        </Link>
      </div>

      <div className="rounded-xl border border-line bg-surface p-1.5 sm:p-2.5">
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {days.map((d, i) => {
            const isToday = d.date === today;
            const isSel = d.date === selected;
            return (
              <Link
                key={d.date}
                href={href(d.date)}
                scroll={false}
                aria-current={isSel ? 'date' : undefined}
                className={cn(
                  'flex min-w-0 flex-col gap-1 rounded-lg p-0.5 pb-1.5 transition-colors sm:p-1',
                  isSel ? 'bg-brand-soft ring-1 ring-brand/40' : 'hover:bg-surface-2/70',
                )}
              >
                <span
                  className={cn(
                    'relative flex flex-col items-center justify-center rounded-md py-1 text-[10px] leading-tight font-medium sm:flex-row sm:gap-1 sm:text-xs',
                    isToday ? 'bg-ink text-bg' : d.date < today ? 'text-muted' : 'text-ink-2',
                  )}
                >
                  <span>
                    {WEEKDAYS[i]}
                    <span className="hidden sm:inline">.</span>
                  </span>
                  <span className="num">{Number(d.date.slice(8))}</span>
                  {d.lateDay && <span aria-label="Atrasada" className="absolute top-1 right-1 size-1.5 rounded-full bg-danger sm:static" />}
                </span>
                {d.sessions.length ? (
                  d.sessions.map((s) => <Block key={s.id} s={s} />)
                ) : (
                  <span className="mt-1 text-center text-[10px] text-muted/70">{d.free ? '—' : 'folga'}</span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 px-1 text-[11px] text-muted">
        {[...disciplines].map(([k, name]) => (
          <span key={k} className="disc flex items-center gap-1.5" style={{ '--dh': disciplineHue(k) } as React.CSSProperties}>
            <span className="size-2 rounded-sm bg-[var(--dc)]" /> {name}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-danger" /> atrasada
        </span>
        <span className="ml-auto hidden sm:inline">Toque em um dia para ver as sessões.</span>
      </div>
    </section>
  );
}

function Block({ s }: { s: WeekSession }) {
  const missed = Boolean(s.movedTo);
  return (
    <span
      className={cn(
        'disc block min-w-0 rounded-md border px-1 py-1 text-[9.5px] leading-tight sm:px-1.5 sm:text-[11px]',
        missed ? 'border-dashed border-line-strong bg-transparent text-muted' : 'border-[var(--dcline)] bg-[var(--dcbg)] text-[var(--dcink)]',
        s.done && 'opacity-60',
      )}
      style={discStyle(s.discipline, s.kind === 'review')}
      title={`${s.disciplineName} · ${s.title}${s.start ? ` · ${s.start}` : ''}${missed ? ` · não feito, foi para ${s.movedTo ? dm(s.movedTo) : 'depois'}` : ''}`}
    >
      {s.start && !s.done && !missed && <span className="num block text-[8.5px] opacity-75 sm:text-[10px]">{s.start}</span>}
      <span className={cn('line-clamp-3 font-medium break-words hyphens-auto', (s.done || missed) && 'line-through')}>{s.title}</span>
      <span className="mt-0.5 flex flex-wrap items-center gap-0.5">
        {s.minutes > 0 && <span className="num rounded bg-[var(--dcbg)] px-0.5 text-[8.5px] font-semibold sm:text-[10px]">{fmt(s.minutes)}</span>}
        {s.late && !missed && <span aria-label="Atrasada" className="size-1.5 rounded-full bg-danger" />}
        {missed && s.movedTo && <span className="num text-[8.5px] sm:text-[10px]">→ {dm(s.movedTo)}</span>}
        {s.done && <span className={cn('text-[8.5px] font-semibold sm:text-[10px]', s.done.passed ? 'text-success' : 'text-danger')}>{s.done.acc}%</span>}
      </span>
    </span>
  );
}
