'use client';

import { Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/components/toast';
import { Badge } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { TASK_KINDS, type MentoriaTask } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';

export function TaskList({ tasks }: { tasks: MentoriaTask[] }) {
  const [list, setList] = useState(tasks);
  const done = list.filter((t) => t.done).length;

  const toggle = async (t: MentoriaTask) => {
    const next = !t.done;
    setList((l) => l.map((x) => (x.id === t.id ? { ...x, done: next } : x)));
    const { error } = await createClient().from('mentoria_tasks').update({ done: next }).eq('id', t.id);
    if (error) {
      setList((l) => l.map((x) => (x.id === t.id ? { ...x, done: !next } : x)));
      toast.error('Não foi possível salvar.');
    }
  };

  if (!list.length) return <p className="rounded-xl bg-surface-2/60 p-4 text-sm text-muted">Nenhuma tarefa para esta semana.</p>;

  return (
    <>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(done / list.length) * 100}%` }} />
      </div>
      <ul className="space-y-2">
        {list.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => toggle(t)}
              className={cn('flex w-full items-start gap-3 rounded-xl border p-3 text-left transition', t.done ? 'border-success/25 bg-success/5' : 'border-line hover:bg-surface-2')}
            >
              <span
                className={cn(
                  'mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 transition',
                  t.done ? 'border-success bg-success text-white' : 'border-line-strong',
                )}
              >
                {t.done && <Check className="size-3.5" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block text-sm font-semibold', t.done ? 'text-muted line-through' : 'text-ink')}>{t.title}</span>
                {t.description && <span className="mt-0.5 block text-xs text-muted">{t.description}</span>}
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <Badge>{TASK_KINDS[t.kind]}</Badge>
                {t.due_date && <span className="text-[10px] text-muted">até {formatDate(t.due_date)}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
