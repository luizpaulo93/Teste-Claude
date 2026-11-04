'use client';

import { ChevronLeft, ChevronRight, Grid3x3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui-client';
import { cn } from '@/lib/utils';

export interface NavItem {
  n: number;
  id: string;
  state: 'certa' | 'errada' | 'respondida' | 'nao';
}

/** Navegação da lista: voltar/avançar uma questão e um quadro com todas as questões (toque leva até ela). */
export function ListNav({ items }: { items: NavItem[] }) {
  const [cur, setCur] = useState(1);
  const [open, setOpen] = useState(false);
  const [states, setStates] = useState(() => new Map(items.map((i) => [i.id, i.state])));

  // questão que está na tela agora
  useEffect(() => {
    const onScroll = () => {
      let n = 1;
      for (const it of items) {
        const el = document.getElementById(`q${it.n}`);
        if (el && el.getBoundingClientRect().top < 160) n = it.n;
      }
      setCur(n);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [items]);

  // marca as respondidas na hora (a resposta avisa por evento)
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ id: string; correct: boolean | null }>).detail;
      setStates((m) => new Map(m).set(d.id, d.correct === null ? 'respondida' : d.correct ? 'certa' : 'errada'));
    };
    window.addEventListener('qanswer', on);
    return () => window.removeEventListener('qanswer', on);
  }, []);

  const go = (n: number) => {
    const k = Math.min(items.length, Math.max(1, n));
    setCur(k);
    setOpen(false);
    // espera o popup fechar (ele trava a rolagem da página) antes de rolar até a questão
    setTimeout(() => document.getElementById(`q${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };
  const tone = (s: NavItem['state'] | undefined) =>
    s === 'certa'
      ? 'border-success bg-success/15 text-success'
      : s === 'errada'
        ? 'border-danger bg-danger/15 text-danger'
        : s === 'respondida'
          ? 'border-brand bg-brand/15 text-brand'
          : 'border-line text-ink-2';

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => go(cur - 1)}
        disabled={cur <= 1}
        aria-label="Questão anterior"
        className="grid size-9 place-items-center rounded-xl border border-line text-ink-2 hover:bg-surface-2 disabled:opacity-40"
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Todas as questões"
        className="flex h-9 items-center gap-1.5 rounded-xl border border-line px-2.5 text-xs font-bold text-ink tabular-nums hover:bg-surface-2"
      >
        <Grid3x3 className="size-4 text-brand" /> {cur}/{items.length}
      </button>
      <button
        type="button"
        onClick={() => go(cur + 1)}
        disabled={cur >= items.length}
        aria-label="Próxima questão"
        className="grid size-9 place-items-center rounded-xl border border-line text-ink-2 hover:bg-surface-2 disabled:opacity-40"
      >
        <ChevronRight className="size-4" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Questões">
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => go(it.n)}
              aria-label={`Ir para a questão ${it.n}`}
              className={cn('grid h-11 place-items-center rounded-xl border text-sm font-bold', tone(states.get(it.id)), it.n === cur && 'ring-2 ring-brand')}
            >
              {it.n}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-muted">
          <span className="flex items-center gap-1">
            <span className="size-3 rounded border border-success bg-success/15" /> certa
          </span>
          <span className="flex items-center gap-1">
            <span className="size-3 rounded border border-danger bg-danger/15" /> errada
          </span>
          <span className="flex items-center gap-1">
            <span className="size-3 rounded border border-line" /> sem resposta
          </span>
        </div>
      </Modal>
    </div>
  );
}
