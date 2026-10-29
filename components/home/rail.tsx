'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Fileira horizontal: setas e arrastar com o mouse no computador, deslizar com o dedo no celular. */
export function Rail({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, x: 0, left: 0, moved: 0 });
  const [dragging, setDragging] = useState(false);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * Math.max(260, ref.current.clientWidth * 0.75), behavior: 'smooth' });

  return (
    <section className="group/rail relative">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold tracking-tight text-ink sm:text-xl">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs font-medium text-muted">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
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
      <div
        ref={ref}
        onMouseDown={(e) => {
          const el = ref.current;
          if (!el || e.button !== 0) return;
          drag.current = { down: true, x: e.pageX, left: el.scrollLeft, moved: 0 };
        }}
        onMouseMove={(e) => {
          const d = drag.current;
          const el = ref.current;
          if (!d.down || !el) return;
          const delta = e.pageX - d.x;
          d.moved = Math.max(d.moved, Math.abs(delta));
          if (d.moved > 6) {
            if (!dragging) setDragging(true);
            e.preventDefault();
            el.scrollLeft = d.left - delta * 1.2;
          }
        }}
        onMouseUp={() => {
          drag.current.down = false;
          if (dragging) window.setTimeout(() => setDragging(false), 40);
        }}
        onMouseLeave={() => {
          drag.current.down = false;
          if (dragging) setDragging(false);
        }}
        // Depois de arrastar, o clique não abre o curso sem querer
        onClickCapture={(e) => {
          if (drag.current.moved > 8) {
            e.preventDefault();
            e.stopPropagation();
            drag.current.moved = 0;
          }
        }}
        onDragStart={(e) => e.preventDefault()}
        className={cn(
          'rail -mx-4 flex gap-3 overflow-x-auto px-4 pt-1 pb-3 sm:mx-0 sm:gap-4 sm:px-0',
          dragging ? 'cursor-grabbing select-none [&_*]:pointer-events-none' : 'sm:cursor-grab',
        )}
      >
        {children}
      </div>
    </section>
  );
}
