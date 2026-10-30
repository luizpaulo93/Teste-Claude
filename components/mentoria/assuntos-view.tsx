'use client';

import { CalendarPlus, Flame, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { addToDay } from '@/app/(app)/mentoria/actions';
import { toast } from '@/components/toast';
import { buttonClass } from '@/components/ui';
import { Modal, Spinner } from '@/components/ui-client';
import { LEVELS, TASK_KIND, WEEKDAYS } from '@/lib/mentoria';
import { cn, formatDate } from '@/lib/utils';

export interface AssuntoRow {
  key: string;
  discipline: string;
  block: string;
  title: string;
  priority: number;
  level: number | null; // null = fora do cronograma
  last_acc: number | null;
  due_on: string | null;
  attempts: number;
  scheduled: string | null;
  /** dia em que o aluno acrescentou o assunto */
  extra: string | null;
  byStudent: boolean;
}

/** Todos os assuntos de cada disciplina e em que parte do estudo o aluno está (cores por situação). */
export function AssuntosView({
  rows,
  disciplines,
  today,
  student = false,
  archived = false,
}: {
  rows: AssuntoRow[];
  disciplines: { key: string; name: string }[];
  /** hoje (AAAA-MM-DD): o aluno pode acrescentar o assunto a hoje ou aos próximos 6 dias */
  today?: string;
  student?: boolean;
  /** ciclo salvo: só mostra como ficou (sem datas) */
  archived?: boolean;
}) {
  const [disc, setDisc] = useState(disciplines[0]?.key ?? '');
  const [open, setOpen] = useState<AssuntoRow | null>(null);
  const list = rows.filter((r) => r.discipline === disc);
  const count = (l: number) => list.filter((r) => (r.level ?? 0) === l).length;
  const blocks = [...new Set(list.map((r) => r.block))];

  return (
    <div className="space-y-4">
      <div className="rail -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {disciplines.map((d) => {
          const all = rows.filter((r) => r.discipline === d.key);
          const pct = all.length ? Math.round((all.filter((r) => (r.level ?? 0) >= 1).length / all.length) * 100) : 0;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => setDisc(d.key)}
              className={cn('shrink-0 rounded-xl border px-3.5 py-2 text-left text-sm font-semibold transition', disc === d.key ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-2')}
            >
              {d.name} <span className="text-xs opacity-75">{pct}%</span>
            </button>
          );
        })}
      </div>

      {/* Resumo por situação */}
      <div className="space-y-2">
        <div className="flex h-3 overflow-hidden rounded-full bg-surface-3">
          {LEVELS.map((l, i) => (
            <div key={l.label} className={l.dot} style={{ width: `${list.length ? (count(i) / list.length) * 100 : 0}%` }} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-2">
          {LEVELS.map((l, i) => (
            <span key={l.label} className="flex items-center gap-1">
              <span className={cn('size-2.5 rounded-full', l.dot)} /> {l.label} <strong className="text-ink tabular-nums">{count(i)}</strong>
            </span>
          ))}
          <span className="flex items-center gap-1">
            <Flame className="size-3 text-orange-500" /> mais cobrado no ENEM
          </span>
        </div>
      </div>

      {blocks.map((b) => (
        <section key={b} className="overflow-hidden rounded-2xl border border-line bg-surface">
          <p className="border-b border-line bg-surface-2/60 px-4 py-2 text-xs font-bold text-ink-2">{b}</p>
          <ul className="divide-y divide-line">
            {list
              .filter((r) => r.block === b)
              .map((r) => {
                const lv = LEVELS[r.level ?? 0];
                return (
                  <li
                    key={r.key}
                    className={cn('flex items-start gap-3 px-4 py-2.5', student && today && 'cursor-pointer transition hover:bg-surface-2/60 active:bg-surface-2')}
                    onClick={student && today ? () => setOpen(r) : undefined}
                  >
                    <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', lv.dot)} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] leading-snug text-ink">
                        {r.title}
                        {r.priority >= 3 && <Flame className="ml-1 inline size-3.5 text-orange-500" />}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                        <span className={cn('rounded px-1.5 py-0.5 font-bold', lv.chip)}>{lv.label}</span>
                        {r.last_acc !== null && <span>acerto {r.last_acc}%</span>}
                        {r.level !== null && r.level >= 1 && r.scheduled && <span>· próxima revisão {formatDate(r.scheduled)}</span>}
                        {r.level === 0 && r.scheduled && <span>· estudar em {formatDate(r.scheduled)}</span>}
                        {r.level === 0 && !r.scheduled && !archived && <span>· não cabe no período da mentoria</span>}
                        {r.level === null && <span>{archived ? 'não entrou neste ciclo' : 'fora do cronograma'}</span>}
                        {r.extra && (
                          <span className="flex items-center gap-0.5 rounded bg-violet-500/15 px-1.5 py-0.5 font-bold text-violet-500">
                            <Plus className="size-2.5" /> {student ? 'você acrescentou' : 'aluno acrescentou'} · {formatDate(r.extra)}
                          </span>
                        )}
                        {!r.extra && r.byStudent && !student && <span className="font-semibold text-violet-500">· escolhido pelo aluno</span>}
                      </span>
                    </span>
                    {student && today && <CalendarPlus className="mt-1 size-4 shrink-0 text-muted" />}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
      {open && today && <AddDialog row={open} today={today} onClose={() => setOpen(null)} />}
    </div>
  );
}

const shiftISO = (date: string, days: number) => {
  const t = new Date(`${date}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
};
const weekday = (d: string) => WEEKDAYS[(new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7];

/** Popup do assunto: acrescentar hoje ou em outro dia da semana. */
function AddDialog({ row, today, onClose }: { row: AssuntoRow; today: string; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const days = Array.from({ length: 6 }, (_, i) => shiftISO(today, i + 1));
  const lv = LEVELS[row.level ?? 0];
  async function add(day: string) {
    setBusy(day);
    const r = await addToDay(row.key, day).catch(() => ({ error: 'Não foi possível salvar.' }));
    setBusy('');
    if (r.error) return toast.error(r.error);
    toast(day === today ? 'Acrescentado ao cronograma de hoje.' : `Acrescentado para ${weekday(day).toLowerCase()}, ${formatDate(day)}.`);
    onClose();
    router.refresh();
  }
  return (
    <Modal open onClose={onClose} title="Acrescentar ao cronograma" size="sm">
      <div className="space-y-4">
        <div>
          <p className="text-[15px] leading-snug font-semibold text-ink">{row.title}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
            <span className={cn('rounded px-1.5 py-0.5 font-bold', lv.chip)}>{lv.label}</span>
            {row.level !== null && <span>vai como {TASK_KIND[Math.min(4, row.level)].toLowerCase()}</span>}
            {row.extra && <span>· já acrescentado para {formatDate(row.extra)}</span>}
          </p>
        </div>
        <button type="button" disabled={!!busy} onClick={() => add(today)} className={buttonClass('primary', 'lg', 'w-full')}>
          {busy === today ? <Spinner /> : <CalendarPlus className="size-4" />} Adicionar hoje
        </button>
        <div>
          <p className="mb-2 text-xs font-semibold text-ink-2">Ou em outro dia da semana</p>
          <div className="grid grid-cols-3 gap-1.5">
            {days.map((d) => (
              <button
                key={d}
                type="button"
                disabled={!!busy}
                onClick={() => add(d)}
                className="flex flex-col items-center rounded-xl border border-line py-2 text-ink-2 transition hover:border-brand hover:text-ink"
              >
                {busy === d ? (
                  <Spinner />
                ) : (
                  <>
                    <span className="text-[10px] font-bold uppercase">{weekday(d)}</span>
                    <span className="text-sm font-extrabold tabular-nums">{`${d.slice(8)}/${d.slice(5, 7)}`}</span>
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-muted">Ele entra além do que o mentor montou para o dia. Seu mentor vê o que você acrescentou.</p>
      </div>
    </Modal>
  );
}
