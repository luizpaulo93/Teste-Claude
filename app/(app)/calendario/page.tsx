import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonClass, Card, PageHeader } from '@/components/ui';
import { EVENT_CATEGORIES, EVENT_COLORS, holidays } from '@/lib/calendar';
import { requireViewer } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { CalendarEvent } from '@/lib/types';
import { cn, formatDate, toISODate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Calendário' };

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireViewer();
  const { m } = await searchParams;
  const now = new Date();
  const [y, mo] = /^\d{4}-\d{2}$/.test(m ?? '') ? m!.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1];
  const first = new Date(y, mo - 1, 1);
  const last = new Date(y, mo, 0);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const days = Array.from({ length: Math.ceil((((first.getDay() + 6) % 7) + last.getDate()) / 7) * 7 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  const supabase = await createClient();
  const { data } = await supabase
    .from('calendar_events')
    .select('*')
    .lte('start_date', toISODate(days[days.length - 1]))
    .gte('end_date', toISODate(days[0]))
    .order('start_date');
  const events = [...((data ?? []) as CalendarEvent[]), ...holidays(y)];
  const eventsOn = (iso: string) => events.filter((e) => e.start_date <= iso && e.end_date >= iso);

  const prev = new Date(y, mo - 2, 1);
  const next = new Date(y, mo, 1);
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const today = toISODate(now);
  const rawLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(first);
  const monthLabel = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
  const monthEvents = events
    .filter((e) => e.end_date >= toISODate(first) && e.start_date <= toISODate(last))
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  return (
    <>
      <PageHeader
        title="Calendário"
        subtitle="Assuntos da semana, simulados, revisões e feriados."
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/calendario?m=${key(prev)}`} scroll={false} className={buttonClass('secondary', 'icon')} aria-label="Mês anterior">
              <ChevronLeft className="size-5" />
            </Link>
            <span className="min-w-36 text-center text-sm font-bold text-ink">{monthLabel}</span>
            <Link href={`/calendario?m=${key(next)}`} scroll={false} className={buttonClass('secondary', 'icon')} aria-label="Próximo mês">
              <ChevronRight className="size-5" />
            </Link>
          </div>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line bg-surface-2/60">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2.5 text-center text-[11px] font-bold tracking-wide text-muted uppercase">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const iso = toISODate(d);
              const inMonth = d.getMonth() === mo - 1;
              const evs = eventsOn(iso);
              return (
                <div key={iso} className={cn('min-h-16 border-r border-b border-line p-1 sm:min-h-24 sm:p-1.5 [&:nth-child(7n)]:border-r-0', !inMonth && 'bg-surface-2/40')}>
                  <span
                    className={cn(
                      'grid size-6 place-items-center rounded-full text-xs font-semibold sm:size-7',
                      iso === today ? 'bg-brand text-white' : inMonth ? 'text-ink' : 'text-muted/60',
                    )}
                  >
                    {d.getDate()}
                  </span>
                  <div className="mt-1 hidden space-y-1 sm:block">
                    {evs.slice(0, 2).map((e) => (
                      <div key={e.id} title={e.title} className={cn('truncate rounded-md border px-1.5 py-0.5 text-[10px] font-semibold', (EVENT_COLORS[e.color] ?? EVENT_COLORS.blue).chip)}>
                        {e.title}
                      </div>
                    ))}
                    {evs.length > 2 && <div className="px-1 text-[10px] font-semibold text-muted">+{evs.length - 2}</div>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                    {evs.slice(0, 4).map((e) => (
                      <span key={e.id} className={cn('size-1.5 rounded-full', (EVENT_COLORS[e.color] ?? EVENT_COLORS.blue).dot)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <p className="mb-3 text-sm font-bold text-ink">Eventos de {rawLabel}</p>
          {monthEvents.length ? (
            <ul className="space-y-3">
              {monthEvents.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', (EVENT_COLORS[e.color] ?? EVENT_COLORS.blue).dot)} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{e.title}</p>
                    <p className="text-xs text-muted">
                      {formatDate(e.start_date)}
                      {e.end_date !== e.start_date && ` – ${formatDate(e.end_date)}`} · {EVENT_CATEGORIES[e.category] ?? ''}
                    </p>
                    {e.description && <p className="mt-1 text-xs text-ink-2">{e.description}</p>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nenhum evento neste mês.</p>
          )}
        </Card>
      </div>
    </>
  );
}
