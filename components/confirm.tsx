'use client';

import { AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { buttonClass } from './ui';

interface Ask {
  id: number;
  message: string;
  confirmLabel: string;
  resolve: (ok: boolean) => void;
}

let counter = 0;
let push: ((a: Ask) => void) | null = null;

/** Confirmação no visual do app (substitui window.confirm). */
export function confirmDialog(message: string, confirmLabel?: string): Promise<boolean> {
  const verb = message.match(/^(Excluir|Apagar|Remover|Encerrar|Iniciar|Liberar|Sair)/)?.[1];
  confirmLabel ??= verb ?? 'Confirmar';
  return new Promise((resolve) => {
    if (!push) return resolve(window.confirm(message));
    push({ id: ++counter, message, confirmLabel, resolve });
  });
}

export function ConfirmHost() {
  const [ask, setAsk] = useState<Ask | null>(null);
  useEffect(() => {
    push = (a) =>
      setAsk((prev) => {
        prev?.resolve(false);
        return a;
      });
    return () => {
      push = null;
    };
  }, []);

  useEffect(() => {
    if (!ask) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  function close(ok: boolean) {
    ask?.resolve(ok);
    setAsk(null);
  }

  if (!ask) return null;
  const danger = /^(Excluir|Apagar|Remover|Encerrar)/.test(ask.confirmLabel);
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center p-3 sm:items-center sm:p-4" role="alertdialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-sm" onClick={() => close(false)} />
      <div className="relative w-full max-w-sm animate-slide-up rounded-3xl border border-line-strong bg-surface p-5 shadow-2xl safe-bottom">
        <div className="flex items-start gap-3">
          <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', danger ? 'bg-danger/12 text-danger' : 'bg-brand/12 text-brand')}>
            <AlertTriangle className="size-5" />
          </span>
          <p className="pt-2 text-sm font-semibold text-ink">{ask.message}</p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" className={buttonClass('secondary', 'md')} onClick={() => close(false)}>
            Cancelar
          </button>
          <button type="button" autoFocus className={danger ? buttonClass('danger', 'md', 'border-transparent bg-danger text-white hover:bg-danger/90') : buttonClass('primary', 'md')} onClick={() => close(true)}>
            {ask.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
