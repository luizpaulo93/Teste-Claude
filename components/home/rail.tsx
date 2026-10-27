'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, type ReactNode } from 'react';

/** Fileira horizontal com setas no desktop e arraste no celular. */
export function Rail({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: 'smooth' });
  return (
    <section className="group/rail relative">
      <div className="mb-3 flex items-end justify-between gap-4">
        <h2 className="text-lg font-extrabold tracking-tight text-ink sm:text-xl">{title}</h2>
        <div className="flex items-center gap-3">
          {action}
          <div className="hidden gap-1 sm:flex">
            <button type="button" aria-label="Voltar" onClick={() => scroll(-1)} className="grid size-8 place-items-center rounded-full border border-line-strong text-ink-2 transition hover:bg-surface-2 hover:text-ink">
              <ChevronLeft className="size-4" />
            </button>
            <button type="button" aria-label="Avançar" onClick={() => scroll(1)} className="grid size-8 place-items-center rounded-full border border-line-strong text-ink-2 transition hover:bg-surface-2 hover:text-ink">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
      <div ref={ref} className="rail -mx-4 flex gap-3 overflow-x-auto scroll-smooth px-4 pt-1 pb-3 sm:mx-0 sm:gap-4 sm:px-0">
        {children}
      </div>
    </section>
  );
}
