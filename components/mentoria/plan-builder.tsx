'use client';

import { Check, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from '@/components/toast';
import { buttonClass } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import { buildGroupPlan } from '@/app/(app)/admin/mentoria/group-actions';
import { buildPlan } from '@/app/(app)/mentoria/actions';
import { cn } from '@/lib/utils';

/** Mentor: escolhe as disciplinas e a ordem; o app gera os assuntos e monta o cronograma nos horários do aluno. */
export function PlanBuilder({
  mentoriaId,
  groupId,
  disciplines,
  chosen,
  order,
  hasSchedule,
}: {
  mentoriaId?: string;
  /** cronograma do grupo (vale para todos os alunos) */
  groupId?: string;
  disciplines: { key: string; name: string; count: number; top: number }[];
  chosen: string[];
  order: string;
  hasSchedule: boolean;
}) {
  const router = useRouter();
  const [sel, setSel] = useState<string[]>(chosen.length ? chosen : []);
  const [mode, setMode] = useState<'prioridade' | 'matriz'>(order === 'matriz' ? 'matriz' : 'prioridade');
  const [busy, setBusy] = useState(false);
  const toggle = (k: string) => setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  async function build() {
    setBusy(true);
    const r = groupId ? await buildGroupPlan(groupId, sel, mode) : await buildPlan(sel, mode, mentoriaId!);
    setBusy(false);
    if (r.error) return toast.error(r.error);
    toast(groupId ? `Cronograma do grupo montado com ${r.count} assuntos` : `Cronograma montado com ${r.count} assuntos`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-bold text-ink">1. Disciplinas</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {disciplines.map((d) => {
            const on = sel.includes(d.key);
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => toggle(d.key)}
                aria-pressed={on}
                className={cn('flex items-start gap-2 rounded-xl border p-3 text-left transition', on ? 'border-brand bg-brand/10' : 'border-line bg-surface hover:bg-surface-2')}
              >
                <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2', on ? 'border-brand bg-brand text-white' : 'border-line-strong')}>
                  {on && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span>
                  <span className="block text-sm font-bold text-ink">{d.name}</span>
                  <span className="block text-[11px] text-muted">
                    {d.count} assuntos · {d.top} mais cobrados
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-bold text-ink">2. Ordem dos assuntos</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ['prioridade', 'Mais cobrados no ENEM primeiro', 'Começa pelos assuntos de maior incidência e segue a matriz'],
              ['matriz', 'Do primeiro ao último', 'Segue a ordem da Matriz de Referência'],
            ] as const
          ).map(([k, t, d]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              className={cn('rounded-xl border p-3 text-left transition', mode === k ? 'border-brand bg-brand/10' : 'border-line bg-surface hover:bg-surface-2')}
            >
              <span className="block text-sm font-bold text-ink">{t}</span>
              <span className="block text-[11px] text-muted">{d}</span>
            </button>
          ))}
        </div>
      </div>
      <button type="button" onClick={build} disabled={busy || !sel.length} className={buttonClass('primary', 'lg', 'w-full sm:w-auto')}>
        {busy ? <Spinner /> : <Sparkles className="size-4" />} {chosen.length ? 'Atualizar cronograma' : 'Gerar cronograma'}
      </button>
      {!hasSchedule && <p className="text-xs text-warning">O aluno ainda não informou os horários. Preencha na aba Horários para distribuir os assuntos nos dias certos.</p>}
    </div>
  );
}
