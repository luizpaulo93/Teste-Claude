'use client';

import { Cake, CalendarDays, Check, ChevronLeft, ChevronRight, LayoutGrid, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { deleteEvent, saveEvent } from '@/app/(app)/admin/misc-actions';
import { toast } from '@/components/toast';
import { Field, Input, Textarea } from '@/components/ui';
import { Modal, Spinner, Switch } from '@/components/ui-client';
import { EVENT_CATEGORIES, EVENT_COLORS, eventColor } from '@/lib/calendar';
import type { CalendarEvent } from '@/lib/types';
import { cn } from '@/lib/utils';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const FORM_CATEGORIES = ['assunto_semana', 'evento_curso', 'simulado', 'revisao'] as const;
const DOT_CATEGORIES = new Set(['simulado', 'revisao', 'evento_curso', 'aviso']);

export interface Birthday {
  id: string;
  name: string;
  /** "MM-DD" */
  md: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m0: number, d: number) => `${y}-${pad(m0 + 1)}-${pad(d)}`;
const todayStr = () => {
  const t = new Date();
  return ymd(t.getFullYear(), t.getMonth(), t.getDate());
};
function shortDate(s: string) {
  const [, m, d] = s.split('-').map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3).toLowerCase()}`;
}
function rangeLabel(a: string, b: string) {
  return a === b ? shortDate(a) : `${shortDate(a)} – ${shortDate(b)}`;
}

/** Calendário no estilo MemberClass: mês ou ano inteiro, faixas contínuas, feriados, aniversários e criação por arraste. */
export function CalendarView({
  year,
  initialDate,
  events: rawEvents,
  birthdays,
  isAdmin,
}: {
  year: number;
  initialDate: string;
  events: CalendarEvent[];
  birthdays: Birthday[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [month, setMonth] = useState(() => Number(initialDate.slice(5, 7)) - 1);
  const [selected, setSelected] = useState(initialDate);
  const [view, setView] = useState<'month' | 'year'>('month');
  const [addMode, setAddMode] = useState(false);
  const [drag, setDrag] = useState<{ anchor: string; current: string } | null>(null);
  const dragRef = useRef<{ anchor: string; current: string } | null>(null);
  const [form, setForm] = useState<{ ev?: CalendarEvent; start: string; end: string } | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const today = todayStr();

  useEffect(() => {
    setMonth(Number(initialDate.slice(5, 7)) - 1);
    setSelected(initialDate);
  }, [initialDate]);

  const events = useMemo(
    () =>
      rawEvents.map((e) => ({
        ...e,
        color: eventColor(e.category, e.color),
        start_date: e.start_date <= e.end_date ? e.start_date : e.end_date,
        end_date: e.end_date >= e.start_date ? e.end_date : e.start_date,
      })),
    [rawEvents],
  );
  const eventsOn = useCallback((d: string) => events.filter((e) => d >= e.start_date && d <= e.end_date), [events]);
  const bdaysOn = useCallback((d: string) => birthdays.filter((b) => b.md === d.slice(5)), [birthdays]);

  const goYear = (y: number, m0: number, d = 1) => router.push(`/calendario?d=${ymd(y, m0, d)}`, { scroll: false });
  const prevMonth = () => (month === 0 ? goYear(year - 1, 11) : setMonth(month - 1));
  const nextMonth = () => (month === 11 ? goYear(year + 1, 0) : setMonth(month + 1));

  // Semanas do mês (domingo a sábado), com dias do mês anterior/seguinte
  const weeks = useMemo(() => {
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay());
    const total = Math.ceil((first.getDay() + new Date(year, month + 1, 0).getDate()) / 7) * 7;
    const cells = Array.from({ length: total }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return { date: ymd(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), inMonth: d.getMonth() === month };
    });
    return Array.from({ length: total / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  }, [year, month]);

  const range = drag ? { start: drag.anchor <= drag.current ? drag.anchor : drag.current, end: drag.anchor <= drag.current ? drag.current : drag.anchor } : null;

  const openNew = (start: string, end: string) => setForm({ start, end });

  const selectDay = (d: string) => {
    if (d.slice(0, 4) !== String(year)) return goYear(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8)));
    if (Number(d.slice(5, 7)) - 1 !== month) setMonth(Number(d.slice(5, 7)) - 1);
    setSelected(d);
    if (window.innerWidth < 768) window.setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
  };

  // Arrastar sobre os dias (mouse e dedo) para escolher o período do evento
  const startDrag = (d: string) => {
    if (!isAdmin || !addMode) return;
    dragRef.current = { anchor: d, current: d };
    setDrag(dragRef.current);
  };
  const moveDrag = (d: string) => {
    if (!dragRef.current || dragRef.current.current === d) return;
    dragRef.current = { ...dragRef.current, current: d };
    setDrag(dragRef.current);
  };
  const endDrag = useCallback(() => {
    const r = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!r) return;
    const s = r.anchor <= r.current ? r.anchor : r.current;
    const e = r.anchor <= r.current ? r.current : r.anchor;
    setSelected(s);
    openNew(s, e);
  }, []);
  useEffect(() => {
    const up = () => dragRef.current && endDrag();
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [endDrag]);

  const dayCell = (cell: { date: string; day: number; inMonth: boolean }, col: number) => {
    const evs = eventsOn(cell.date);
    const multi = evs.find((e) => e.start_date !== e.end_date);
    const holiday = evs.find((e) => e.category.startsWith('feriado'));
    const primary = multi ?? evs[0];
    const pal = EVENT_COLORS[primary?.color ?? 'blue'] ?? EVENT_COLORS.blue;
    const dots = evs.filter((e) => DOT_CATEGORIES.has(e.category)).slice(0, 3);
    const bdays = bdaysOn(cell.date);
    const inRange = Boolean(range && cell.date >= range.start && cell.date <= range.end);
    const isSel = cell.date === selected && !range;

    const bandShape = (s: string, e: string) => {
      const isS = cell.date === s;
      const isE = cell.date === e;
      if (isS && isE) return 'left-1 right-1 rounded-full';
      if (isS) return 'left-1 right-0 rounded-l-full';
      if (isE) return 'left-0 right-1 rounded-r-full';
      return col === 0 ? 'left-0 right-0' : col === 6 ? 'left-0 right-0' : 'left-0 right-0';
    };

    // Visual suave: tons claros, sem bordas grossas nem brilho
    let circle = cell.inMonth ? 'font-medium text-ink-2 group-hover:bg-surface-2' : 'text-muted/40';
    if (inRange) circle = cell.date === range!.start || cell.date === range!.end ? 'bg-brand font-semibold text-white' : 'font-semibold text-brand';
    else if (isSel) circle = 'bg-brand font-semibold text-white shadow-[0_4px_14px_-4px_rgba(37,99,235,0.6)]';
    else if (cell.date === today) circle = 'font-bold text-brand ring-1 ring-brand/50';
    else if (holiday) circle = 'bg-rose-500/12 font-semibold text-rose-400';
    else if (primary && !multi) circle = cn('font-semibold', pal.circle);
    else if (multi) circle = 'font-semibold text-ink';

    return (
      <div
        key={cell.date}
        data-date={cell.date}
        onClick={() => !addMode && selectDay(cell.date)}
        onMouseDown={() => startDrag(cell.date)}
        onMouseEnter={() => moveDrag(cell.date)}
        onTouchStart={() => startDrag(cell.date)}
        className="group relative flex h-12 cursor-pointer items-center justify-center select-none sm:h-14"
      >
        {multi && !inRange && <div className={cn('pointer-events-none absolute top-1/2 h-9 -translate-y-1/2 sm:h-10', pal.band, bandShape(multi.start_date, multi.end_date))} />}
        {inRange && <div className={cn('pointer-events-none absolute top-1/2 h-9 -translate-y-1/2 bg-brand/12 sm:h-10', bandShape(range!.start, range!.end))} />}
        {bdays.length > 0 && (
          <span className="pointer-events-none absolute top-0 left-1/2 z-20 -translate-x-1/2 text-[10px] leading-none" title={`Aniversário: ${bdays.map((b) => b.name).join(', ')}`}>
            🎂
          </span>
        )}
        <div className={cn('relative z-10 grid size-9 place-items-center rounded-full text-xs transition-all duration-200 ease-out sm:size-10 sm:text-sm', circle)}>{cell.day}</div>
        {dots.length > 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0.5 z-20 flex justify-center gap-1">
            {dots.map((e) => (
              <span key={e.id} className={cn('size-1.5 rounded-full', (EVENT_COLORS[e.color] ?? EVENT_COLORS.blue).dot)} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const dayEvents = eventsOn(selected).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const dayBdays = bdaysOn(selected);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-full bg-brand text-white shadow-glow">
            <CalendarDays className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">Calendário {year}</h1>
            <p className="text-xs text-muted">Assuntos da semana, simulados, revisões, feriados e aniversários</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setView((v) => (v === 'month' ? 'year' : 'month'))}
            className={cn('flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold transition', view === 'year' ? 'border-brand bg-brand text-white' : 'border-line bg-surface-2 text-ink-2 hover:bg-surface-3')}
          >
            <LayoutGrid className="size-3.5" /> {view === 'year' ? 'Ver mês' : 'Ano todo'}
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setAddMode((v) => !v);
                setView('month');
              }}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold text-white transition',
                addMode ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-brand hover:bg-brand-strong',
              )}
            >
              {addMode ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
              {addMode ? 'Modo adicionar ativo' : 'Adicionar evento'}
            </button>
          )}
        </div>
      </div>

      {/* Navegação */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Anterior" onClick={view === 'year' ? () => goYear(year - 1, 0) : prevMonth} className="grid size-9 place-items-center rounded-full bg-surface-2 text-brand hover:bg-surface-3">
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-40 text-center text-base font-extrabold text-ink sm:text-lg">{view === 'year' ? `Ano ${year}` : `${MONTHS[month]} ${year}`}</span>
          <button type="button" aria-label="Próximo" onClick={view === 'year' ? () => goYear(year + 1, 0) : nextMonth} className="grid size-9 place-items-center rounded-full bg-surface-2 text-brand hover:bg-surface-3">
            <ChevronRight className="size-4" />
          </button>
        </div>
        <p className="text-xs font-medium text-muted">
          {addMode ? 'Clique em um dia ou arraste sobre vários dias para criar o evento' : 'Toque em uma data para ver os eventos do dia'}
        </p>
      </div>

      {view === 'year' ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {MONTHS.map((name, m0) => {
            const first = new Date(year, m0, 1).getDay();
            const count = new Date(year, m0 + 1, 0).getDate();
            const isNow = today.slice(0, 7) === `${year}-${pad(m0 + 1)}`;
            return (
              <div
                key={name}
                onClick={() => {
                  setMonth(m0);
                  setView('month');
                }}
                className={cn('cursor-pointer rounded-2xl border p-3.5 transition', isNow ? 'border-brand/60 bg-surface-2 shadow-glow' : 'border-line bg-surface shadow-card hover:border-brand/40')}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-extrabold text-ink">{name}</span>
                  {isNow && <span className="size-2 rounded-full bg-brand" />}
                </div>
                <div className="mb-1 grid grid-cols-7 gap-1 text-center">
                  {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                    <span key={i} className="text-[9px] font-bold text-muted">
                      {d}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: first }, (_, i) => (
                    <span key={`e${i}`} />
                  ))}
                  {Array.from({ length: count }, (_, i) => {
                    const d = ymd(year, m0, i + 1);
                    const top = eventsOn(d)[0];
                    const bday = bdaysOn(d).length > 0;
                    return (
                      <span key={d} className="relative flex justify-center">
                        {bday && <span className="pointer-events-none absolute -top-1.5 text-[7px] leading-none">🎂</span>}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMonth(m0);
                            setSelected(d);
                            setView('month');
                          }}
                          className={cn(
                            'grid size-5 place-items-center rounded-full text-[9px] font-bold transition hover:scale-110',
                            d === today ? 'bg-brand text-white' : top ? cn((EVENT_COLORS[top.color] ?? EVENT_COLORS.blue).dot, 'text-black') : 'text-muted hover:bg-surface-3',
                          )}
                        >
                          {i + 1}
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid items-start gap-6 md:grid-cols-12">
          <div
            onTouchMove={(e) => {
              if (!dragRef.current) return;
              const t = e.touches[0];
              const el = document.elementFromPoint(t.clientX, t.clientY)?.closest('[data-date]') as HTMLElement | null;
              if (el?.dataset.date) moveDrag(el.dataset.date);
            }}
            onTouchEnd={() => dragRef.current && endDrag()}
            className={cn('w-full space-y-2.5 rounded-3xl border border-line bg-surface p-3 shadow-card select-none sm:p-5 md:col-span-7', addMode && 'touch-none')}
          >
            <div className="grid grid-cols-7 border-b border-line pb-2.5 text-center">
              {WEEKDAYS.map((w) => (
                <span key={w} className="text-[11px] font-bold tracking-wider text-muted uppercase sm:text-xs">
                  {w}
                </span>
              ))}
            </div>
            <div className="space-y-1 pt-1">
              {weeks.map((row, i) => (
                <div key={i} className="grid grid-cols-7">
                  {row.map((cell, col) => dayCell(cell, col))}
                </div>
              ))}
            </div>
          </div>

          {/* Painel do dia */}
          <section ref={panelRef} className="space-y-4 rounded-3xl border border-line bg-surface p-4 shadow-card sm:p-5 md:sticky md:top-6 md:col-span-5">
            <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
              <div className="min-w-0">
                <span className="block text-[10px] font-extrabold tracking-wider text-brand uppercase">Dia selecionado</span>
                <h2 className="truncate text-sm font-extrabold text-ink sm:text-base">
                  {shortDate(selected)} de {selected.slice(0, 4)}
                </h2>
              </div>
              {isAdmin && (
                <button type="button" onClick={() => openNew(selected, selected)} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-strong">
                  <Plus className="size-3.5" /> Novo evento
                </button>
              )}
            </div>
            {!dayEvents.length && !dayBdays.length ? (
              <div className="space-y-1 rounded-2xl border border-line bg-surface-2 p-5 text-center">
                <p className="text-sm font-bold text-ink">Nenhum evento neste dia</p>
                <p className="text-xs text-muted">Não há aulas especiais, simulados ou eventos em {shortDate(selected)}.</p>
              </div>
            ) : (
              <div className="scrollbar-thin max-h-[55dvh] space-y-3 overflow-y-auto pr-1">
                {dayBdays.map((b) => (
                  <div key={b.id} className="flex items-start gap-3 rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-500/15 to-transparent p-3.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full border border-amber-400/50 bg-amber-500/25 text-amber-500">
                      <Cake className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-extrabold tracking-wider text-amber-500 uppercase">🎂 Aniversariante</p>
                      <p className="truncate text-sm font-extrabold text-ink">{b.name}</p>
                      <p className="text-xs text-ink-2">Dia de celebrar mais um ano de vida e conquistas!</p>
                    </div>
                  </div>
                ))}
                {dayEvents.map((e) => {
                  const pal = EVENT_COLORS[e.color] ?? EVENT_COLORS.blue;
                  const system = e.id.startsWith('h-');
                  return (
                    <div key={e.id} className={cn('flex items-start justify-between gap-3 rounded-2xl border bg-surface-2 p-3.5', pal.chip.split(' ')[2])}>
                      <div className="flex min-w-0 items-start gap-3">
                        <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', pal.dot)} />
                        <div className="min-w-0 space-y-1">
                          <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                            <span className={pal.chip.split(' ')[1]}>{EVENT_CATEGORIES[e.category] ?? 'Evento'}</span>
                            <span className="text-muted">·</span>
                            <span className="text-brand">{rangeLabel(e.start_date, e.end_date)}</span>
                            {!e.is_published && <span className="rounded bg-surface-3 px-1.5 text-muted">oculto</span>}
                          </p>
                          <p className="text-sm leading-snug font-extrabold text-ink">{e.title}</p>
                          {e.description && <p className="text-xs leading-relaxed text-ink-2">{e.description}</p>}
                        </div>
                      </div>
                      {isAdmin && !system && <EventActions ev={e} onEdit={() => setForm({ ev: e, start: e.start_date, end: e.end_date })} />}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {isAdmin && (
        <EventForm
          state={form}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            setAddMode(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function EventActions({ ev, onEdit }: { ev: CalendarEvent; onEdit: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button type="button" onClick={onEdit} title="Editar" className="grid size-7 place-items-center rounded-full bg-surface-3 text-ink-2 hover:text-ink">
        <Pencil className="size-3.5" />
      </button>
      <button
        type="button"
        title="Excluir"
        disabled={pending}
        onClick={() => {
          if (!confirm('Excluir este evento?')) return;
          start(async () => {
            const r = await deleteEvent(ev.id);
            if (r.error) toast.error(r.error);
            else {
              toast('Evento excluído');
              router.refresh();
            }
          });
        }}
        className="grid size-7 place-items-center rounded-full bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
      >
        {pending ? <Spinner /> : <Trash2 className="size-3.5" />}
      </button>
    </div>
  );
}

function EventForm({ state, onClose, onSaved }: { state: { ev?: CalendarEvent; start: string; end: string } | null; onClose: () => void; onSaved: () => void }) {
  const [category, setCategory] = useState('assunto_semana');
  const [color, setColor] = useState('blue');
  const [pending, start] = useTransition();
  useEffect(() => {
    if (!state) return;
    setCategory(state.ev?.category && FORM_CATEGORIES.includes(state.ev.category as never) ? state.ev.category : state.ev ? 'evento_curso' : 'assunto_semana');
    setColor(state.ev?.color ?? 'blue');
  }, [state]);

  return (
    <Modal open={Boolean(state)} onClose={onClose} title={state?.ev ? 'Editar evento' : 'Novo evento'}>
      {state && (
        <form
          key={`${state.ev?.id ?? 'new'}-${state.start}-${state.end}`}
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const r = await saveEvent(fd);
              if (r.error) toast.error(r.error);
              else {
                toast('Evento salvo');
                onSaved();
              }
            });
          }}
        >
          {state.ev && <input type="hidden" name="id" value={state.ev.id} />}
          <input type="hidden" name="category" value={category} />
          <input type="hidden" name="color" value={eventColor(category, color)} />
          <Field label="Título">
            <Input name="title" defaultValue={state.ev?.title} required maxLength={160} autoFocus placeholder="Ex.: Assunto da semana — Cinemática" />
          </Field>
          <div>
            <span className="text-xs font-semibold text-ink-2">Tipo</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {FORM_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn('rounded-xl border px-3 py-2 text-left text-xs font-bold transition', category === c ? 'border-brand bg-brand/15 text-ink' : 'border-line bg-surface-2 text-ink-2 hover:bg-surface-3')}
                >
                  <span className={cn('mr-1.5 inline-block size-2 rounded-full', EVENT_COLORS[eventColor(c, color)].dot)} />
                  {EVENT_CATEGORIES[c]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Início">
              <Input name="start_date" type="date" defaultValue={state.start} required />
            </Field>
            <Field label="Fim">
              <Input name="end_date" type="date" defaultValue={state.end} />
            </Field>
          </div>
          {category === 'evento_curso' && (
            <div>
              <span className="text-xs font-semibold text-ink-2">Cor</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(EVENT_COLORS)
                  .filter(([k]) => k !== 'slate')
                  .map(([k, v]) => (
                    <button key={k} type="button" onClick={() => setColor(k)} aria-label={v.label} title={v.label} className={cn('size-8 rounded-full ring-offset-2 ring-offset-surface transition', v.dot, color === k && 'ring-2 ring-ink')} />
                  ))}
              </div>
            </div>
          )}
          <Field label="Descrição (opcional)">
            <Textarea name="description" defaultValue={state.ev?.description} rows={3} maxLength={2000} />
          </Field>
          <Switch name="is_published" defaultChecked={state.ev?.is_published ?? true} label="Visível para alunos" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-surface-2">
              Cancelar
            </button>
            <button type="submit" disabled={pending} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-strong disabled:opacity-60">
              {pending && <Spinner />} Salvar evento
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
