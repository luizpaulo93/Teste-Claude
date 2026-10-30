import { Archive, CalendarRange, Check, ChevronRight, X } from 'lucide-react';
import Link from 'next/link';
import { ApostilasFolder } from '@/components/mentoria/apostilas';
import { AssuntosView, type AssuntoRow } from '@/components/mentoria/assuntos-view';
import { ASSUNTO_BY_KEY, ASSUNTOS, DISCIPLINES } from '@/lib/enem-matriz';
import { FEELS, GOAL, TASK_KIND } from '@/lib/mentoria';
import type { cyclesOf, Cycle } from '@/lib/mentoria-cycles';
import { cn, formatDate } from '@/lib/utils';

const dmy = (d: string | null) => (d ? formatDate(d) : '');
const period = (a: string | null, b: string | null) => [dmy(a), dmy(b)].filter(Boolean).join(' a ');

/** Lista dos ciclos anteriores (salvos quando o mentor começou um novo). */
export function CycleList({ list, base }: { list: Awaited<ReturnType<typeof cyclesOf>>; base: string }) {
  if (!list.length)
    return <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-sm text-muted">Nenhum ciclo anterior. Quando o mentor começar um ciclo novo, o atual fica salvo aqui.</p>;
  return (
    <ul className="space-y-2">
      {list.map((c) => (
        <li key={c.id}>
          <Link href={`${base}/${c.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition hover:border-brand/50">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-ink-2">
              <Archive className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-ink">{c.title}</span>
              <span className="block text-xs text-muted">
                {period(c.start_date, c.end_date) || `salvo em ${formatDate(c.created_at)}`} · {c.studied}/{c.total} assuntos estudados
                {c.files > 0 && ` · ${c.files} apostila${c.files > 1 ? 's' : ''}`}
              </span>
            </span>
            <ChevronRight className="size-4 text-muted" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Tudo o que foi feito num ciclo: números, assuntos (como ficaram), o que fez em cada dia e as apostilas. */
export function CycleView({ cycle, today }: { cycle: Cycle; today: string }) {
  const by = new Map(cycle.cards.map((c) => [c.item_key, c]));
  const specific = cycle.scope === 'especifica';
  const inPlan = new Set(cycle.cards.map((c) => c.discipline));
  const disciplines = DISCIPLINES.filter((d) => !specific || inPlan.has(d.key)).map((d) => ({ key: d.key, name: d.name }));
  const rows: AssuntoRow[] = ASSUNTOS.filter((a) => (specific ? by.has(a.key) : true)).map((a) => {
    const c = by.get(a.key);
    return { key: a.key, discipline: a.discipline, block: a.block, title: a.title, priority: a.priority, level: c ? c.level : null, last_acc: c?.last_acc ?? null, due_on: null, attempts: c?.attempts ?? 0, scheduled: null, extra: null, byStudent: false };
  });
  const names = Object.fromEntries(DISCIPLINES.map((d) => [d.key, d.name]));
  const done = cycle.cards
    .flatMap((c) => (c.history ?? []).map((h) => ({ ...h, title: ASSUNTO_BY_KEY.get(c.item_key)?.title ?? c.title, discipline: names[c.discipline] ?? c.discipline })))
    .sort((a, b) => b.d.localeCompare(a.d));
  const days = [...new Set(done.map((x) => x.d))];
  const q = done.reduce((a, x) => a + x.q, 0);
  const ok = done.reduce((a, x) => a + x.c, 0);
  const studied = cycle.cards.filter((c) => c.level > 0).length;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-muted uppercase">
          <Archive className="size-3.5" /> Ciclo salvo · {specific ? 'mentoria específica' : 'mentoria completa'}
        </p>
        <h2 className="mt-1 text-lg font-extrabold text-ink">{cycle.title}</h2>
        <p className="flex items-center gap-1 text-xs text-muted">
          <CalendarRange className="size-3.5" /> {period(cycle.start_date, cycle.end_date) || `salvo em ${formatDate(cycle.created_at)}`}
          {cycle.exam_date && ` · prova em ${formatDate(cycle.exam_date)}`}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ['Assuntos estudados', `${studied}/${cycle.cards.length}`],
            ['Questões', String(q)],
            ['Acerto', q ? `${Math.round((ok / q) * 100)}%` : '-'],
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-surface-2/60 p-2.5">
              <p className="text-lg font-extrabold text-ink tabular-nums">{v}</p>
              <p className="text-[10px] text-muted">{l}</p>
            </div>
          ))}
        </div>
      </div>

      {cycle.blocks.some((b) => b.files.length) && (
        <section className="space-y-2">
          <h3 className="text-sm font-bold text-ink">Apostilas</h3>
          <ApostilasFolder groups={cycle.blocks} today={today} />
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-bold text-ink">O que foi feito</h3>
        {days.length ? (
          <div className="space-y-3">
            {days.map((d) => (
              <div key={d} className="rounded-2xl border border-line bg-surface p-3">
                <p className="mb-1.5 text-xs font-bold text-ink-2">{formatDate(d)}</p>
                <ul className="space-y-1.5">
                  {done
                    .filter((x) => x.d === d)
                    .map((x, i) => {
                      const acc = x.q ? Math.round((x.c / x.q) * 100) : 0;
                      const passed = acc >= (x.l ? GOAL[Math.min(4, x.l)] : 0);
                      return (
                        <li key={i} className="flex items-start gap-2 text-[13px]">
                          {passed ? <Check className="mt-0.5 size-3.5 shrink-0 text-success" /> : <X className="mt-0.5 size-3.5 shrink-0 text-danger" />}
                          <span className="min-w-0 flex-1">
                            <span className="font-semibold text-ink">{x.title}</span>
                            <span className="block text-[11px] text-muted">
                              {x.discipline} · {TASK_KIND[Math.min(4, x.l)]} · {x.c}/{x.q} ({acc}%)
                              {x.f ? ` · ${FEELS[x.f - 1].emoji} ${FEELS[x.f - 1].label}` : ''}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className={cn('rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-muted')}>Nada registrado neste ciclo.</p>
        )}
      </section>

      {disciplines.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-bold text-ink">Como ficaram os assuntos</h3>
          <AssuntosView rows={rows} disciplines={disciplines} archived />
        </section>
      )}
    </div>
  );
}
