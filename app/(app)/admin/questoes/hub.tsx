'use client';

import { ChevronRight, FilePlus2, ListChecks, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Importer } from './importer';

const card = 'flex min-w-0 items-center gap-3 rounded-2xl border p-4 text-left transition';

/** Atalhos da tela Questões: cadastrar (JSON + imagens, aqui mesmo), montar listas e excluir em lote. */
export function QuestionsHub() {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={cn(card, open ? 'border-brand bg-brand/8' : 'border-line bg-surface hover:border-brand/40')}
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand">
            <FilePlus2 className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-ink">Cadastrar questões</span>
            <span className="block text-xs text-muted">JSON e imagens</span>
          </span>
          <ChevronRight className={cn('size-4 shrink-0 text-muted transition', open && 'rotate-90')} />
        </button>
        <Link href="/admin/questoes/listas" className={cn(card, 'border-line bg-surface hover:border-brand/40')}>
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success/12 text-success">
            <ListChecks className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-ink">Montar listas</span>
            <span className="block text-xs text-muted">Provas, testes e exercícios</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted" />
        </Link>
        <Link href="/admin/questoes/excluir" className={cn(card, 'border-line bg-surface hover:border-danger/40')}>
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-danger/12 text-danger">
            <Trash2 className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-ink">Excluir questões</span>
            <span className="block text-xs text-muted">Várias de uma vez</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted" />
        </Link>
      </div>
      {open && <Importer />}
    </div>
  );
}
