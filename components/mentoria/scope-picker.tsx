'use client';

import { BookOpen, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MentoriaScope = 'completa' | 'especifica';

const OPTIONS = [
  { value: 'completa' as const, icon: BookOpen, title: 'Mentoria completa', text: 'Todos os assuntos de Matemática e Ciências da Natureza.' },
  { value: 'especifica' as const, icon: ListChecks, title: 'Mentoria específica', text: 'Só os assuntos que você escolher para o aluno.' },
];

/** Tipo da mentoria: completa (todos os assuntos) ou específica (só os escolhidos). */
export function ScopePicker({ value, onChange }: { value: MentoriaScope; onChange: (v: MentoriaScope) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-ink-2">Tipo de mentoria</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn('flex items-start gap-3 rounded-xl border p-3 text-left transition', value === o.value ? 'border-brand bg-brand/10' : 'border-line hover:bg-surface-2')}
          >
            <o.icon className={cn('mt-0.5 size-5 shrink-0', value === o.value ? 'text-brand' : 'text-muted')} />
            <span>
              <span className="block text-sm font-bold text-ink">{o.title}</span>
              <span className="block text-xs text-muted">{o.text}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
