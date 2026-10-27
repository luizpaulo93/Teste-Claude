'use client';

import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type ToastKind = 'success' | 'error';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

let counter = 0;
const listeners = new Set<(t: ToastItem) => void>();

export function toast(message: string, kind: ToastKind = 'success') {
  const item = { id: ++counter, kind, message };
  listeners.forEach((l) => l(item));
}
toast.error = (message: string) => toast(message, 'error');

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const add = (t: ToastItem) => {
      setItems((prev) => [...prev.slice(-2), t]);
      window.setTimeout(() => setItems((prev) => prev.filter((p) => p.id !== t.id)), 3800);
    };
    listeners.add(add);
    return () => {
      listeners.delete(add);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className="pointer-events-auto flex w-full max-w-sm animate-slide-up items-center gap-3 rounded-2xl border border-line-strong bg-surface/95 px-4 py-3 text-sm shadow-card backdrop-blur"
        >
          {t.kind === 'success' ? (
            <CheckCircle2 className="size-5 shrink-0 text-success" />
          ) : (
            <AlertTriangle className="size-5 shrink-0 text-danger" />
          )}
          <span className="flex-1 text-ink">{t.message}</span>
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setItems((prev) => prev.filter((p) => p.id !== t.id))}
            className="text-muted hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
