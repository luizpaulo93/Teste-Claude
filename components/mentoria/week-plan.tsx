'use client';

import { Check, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from '@/components/toast';
import { Badge, buttonClass } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import { confirmDialog } from '@/components/confirm';
import { generateWeek, toggleTask } from '@/app/(app)/mentoria/actions';
import { fmtMinutes, WEEKDAYS } from '@/lib/mentoria';
import { TASK_KINDS, type MentoriaTask } from '@/lib/types';
import { addDays, cn, formatDate } from '@/lib/utils';

/** Plano da semana dia a dia, com o botão para montar o cronograma automático. */
export function WeekPlan({ tasks, week, today, mentoriaId, canGenerate = true }: { tasks: MentoriaTask[]; week: string; today: string; mentoriaId?: string; canGenerate?: boolean }) {
  const router = useRouter();
  const [list, setList] = useState(tasks);
  const [busy, setBusy] = useState(false);
  const done = list.filter((t) => t.done).length;

  const toggle = async (t: MentoriaTask) => {
    const next = !t.done;
    setList((l) => l.map((x) => (x.id === t.id ? { ...x, done: next } : x)));
    const r = await toggleTask(t.id, next, mentoriaId).catch(() => ({ error: 'rede' }));
    if (r.error) {
      setList((l) => l.map((x) => (x.id === t.id ? { ...x, done: !next } : x)));
      toast.error('Não foi possível salvar.');
    }
  };

  async function generate() {
    if (list.some((t) => t.auto && !t.done) && !(await confirmDialog('Refazer o cronograma automático desta semana? Tarefas feitas e as do mentor ficam.', 'Refazer'))) return;
    setBusy(true);
    const r = await generateWeek(week, mentoriaId);
    setBusy(false);
    if (r.error) return toast.error(r.error);
    toast(`Cronograma pronto: ${r.count} blocos de estudo`);
    router.refresh();
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const undated = list.filter((t) => !t.due_date);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="h-2 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${list.length ? (done / list.length) * 100 : 0}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted">
            {done}/{list.length} concluídas · {fmtMinutes(list.reduce((a, t) => a + (t.minutes || 0), 0))} planejados
          </p>
        </div>
        {canGenerate && (
          <button type="button" onClick={generate} disabled={busy} className={buttonClass('primary', 'sm')}>
            {busy ? <Spinner /> : <Sparkles className="size-3.5" />} {list.some((t) => t.auto) ? 'Refazer cronograma' : 'Gerar cronograma'}
          </button>
        )}
      </div>

      {!list.length && <p className="rounded-xl bg-surface-2/60 p-4 text-sm text-muted">Nenhuma tarefa nesta semana. Toque em “Gerar cronograma” para montar o plano com base no seu diagnóstico.</p>}

      {days.map((d, i) => {
        const items = list.filter((t) => t.due_date === d);
        if (!items.length) return null;
        return (
          <section key={d} className="space-y-2">
            <p className={cn('text-xs font-bold tracking-wide uppercase', d === today ? 'text-brand' : 'text-muted')}>
              {WEEKDAYS[i]} · {formatDate(d)}
              {d === today && ' · hoje'}
            </p>
            <TaskItems items={items} toggle={toggle} />
          </section>
        );
      })}
      {undated.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-bold tracking-wide text-muted uppercase">Durante a semana</p>
          <TaskItems items={undated} toggle={toggle} />
        </section>
      )}
    </div>
  );
}

export function TaskItems({ items, toggle }: { items: MentoriaTask[]; toggle: (t: MentoriaTask) => void }) {
  return (
    <ul className="space-y-2">
      {items.map((t) => (
        <li key={t.id}>
          <button
            type="button"
            onClick={() => toggle(t)}
            className={cn('flex w-full items-start gap-3 rounded-xl border p-3 text-left transition', t.done ? 'border-success/25 bg-success/5' : 'border-line bg-surface hover:bg-surface-2')}
          >
            <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 transition', t.done ? 'border-success bg-success text-white' : 'border-line-strong')}>
              {t.done && <Check className="size-3.5" strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn('block text-sm font-semibold', t.done ? 'text-muted line-through' : 'text-ink')}>{t.title}</span>
              {t.description && <span className="mt-0.5 block text-xs text-muted">{t.description}</span>}
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <Badge tone={t.auto ? 'neutral' : 'brand'}>{TASK_KINDS[t.kind]}</Badge>
              {t.minutes > 0 && <span className="text-[10px] text-muted">{fmtMinutes(t.minutes)}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
