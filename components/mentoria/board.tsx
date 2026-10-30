'use client';

import { ArrowRight, Flame, GripVertical } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from '@/components/toast';
import { buttonClass, Input } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import { moveCard, scoreCard } from '@/app/(app)/mentoria/actions';
import { LEVELS, PASS, STEPS, type Step } from '@/lib/mentoria';
import { cn, formatDate } from '@/lib/utils';

export interface BoardCard {
  id: string;
  discipline: string;
  title: string;
  priority: number;
  level: number;
  step: Step;
  last_acc: number | null;
}

const KIND = ['Assunto novo', 'Revisão 01', 'Revisão 02', 'Revisão 03'];

/** Quadro do dia: Estudar → Resolver questões → Marcar desempenho. Arraste pelo ⋮⋮ ou toque na seta. */
export function Board({ cards, done, mentoriaId }: { cards: BoardCard[]; done: { id: string; discipline: string; title: string; acc: number | null; level: number; due: string | null }[]; mentoriaId?: string }) {
  const router = useRouter();
  const [list, setList] = useState(cards);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; dx: number; dy: number } | null>(null);
  const [over, setOver] = useState<Step | null>(null);
  const start = useRef<{ id: string; x: number; y: number } | null>(null);

  async function move(id: string, step: Step) {
    const card = list.find((c) => c.id === id);
    if (!card || card.step === step) return;
    setList((l) => l.map((c) => (c.id === id ? { ...c, step } : c)));
    const r = await moveCard(id, step, mentoriaId).catch(() => ({ error: 'rede' }));
    if (r.error) {
      setList((l) => l.map((c) => (c.id === id ? { ...c, step: card.step } : c)));
      toast.error('Não foi possível mover o card.');
    }
  }

  // Arrastar (mouse e dedo) pelo puxador
  const colAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest('[data-col]') as HTMLElement | null)?.dataset.col as Step | undefined;
  const onDown = (e: React.PointerEvent, id: string) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { id, x: e.clientX, y: e.clientY };
    setDrag({ id, x: e.clientX, y: e.clientY, dx: 0, dy: 0 });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    setDrag({ id: start.current.id, x: e.clientX, y: e.clientY, dx: e.clientX - start.current.x, dy: e.clientY - start.current.y });
    setOver(colAt(e.clientX, e.clientY) ?? null);
  };
  const onUp = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    setDrag(null);
    setOver(null);
    if (!s) return;
    const col = colAt(e.clientX, e.clientY);
    if (col) void move(s.id, col);
  };

  if (!list.length && !done.length)
    return <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-sm text-muted">Nada para hoje. Veja os próximos dias na aba Semana.</p>;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        {STEPS.map((col, ci) => {
          const items = list.filter((c) => c.step === col.key);
          return (
            <section
              key={col.key}
              data-col={col.key}
              className={cn('min-h-28 rounded-2xl border bg-surface-2/50 p-2.5 transition', over === col.key ? 'border-brand bg-brand/10' : 'border-line')}
            >
              <p className="mb-2 flex items-center justify-between px-1 text-xs font-bold text-ink-2 uppercase">
                <span>
                  {ci + 1}. {col.label}
                </span>
                <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] tabular-nums">{items.length}</span>
              </p>
              <ul className="space-y-2">
                {items.map((c) => (
                  <li
                    key={c.id}
                    style={drag?.id === c.id ? { transform: `translate(${drag.dx}px, ${drag.dy}px)`, zIndex: 30, position: 'relative', pointerEvents: 'none' } : undefined}
                    className={cn('rounded-xl border border-line bg-surface p-3 shadow-card', drag?.id === c.id && 'opacity-90 shadow-2xl')}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        aria-label="Arrastar"
                        onPointerDown={(e) => onDown(e, c.id)}
                        onPointerMove={onMove}
                        onPointerUp={onUp}
                        onPointerCancel={onUp}
                        className="-ml-1 grid size-7 shrink-0 cursor-grab touch-none place-items-center rounded-md text-muted hover:bg-surface-2 active:cursor-grabbing"
                      >
                        <GripVertical className="size-4" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-brand uppercase">
                          {c.discipline}
                          {c.priority >= 3 && (
                            <span className="flex items-center gap-0.5 rounded bg-orange-500/15 px-1 text-[10px] text-orange-500 normal-case" title="Mais cobrado no ENEM">
                              <Flame className="size-3" /> Mais cobrado
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-sm leading-snug font-semibold text-ink">{c.title}</p>
                        <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-bold', LEVELS[c.level === 0 ? 0 : c.level].chip)}>{KIND[c.level] ?? 'Revisão'}</span>
                          {c.last_acc !== null && <span className="text-[10px] text-muted">último acerto {c.last_acc}%</span>}
                        </p>
                      </div>
                      {col.key !== 'score' && (
                        <button
                          type="button"
                          onClick={() => move(c.id, STEPS[ci + 1].key)}
                          aria-label={`Passar para ${STEPS[ci + 1].label}`}
                          title={STEPS[ci + 1].label}
                          className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand/12 text-brand transition hover:bg-brand hover:text-white"
                        >
                          <ArrowRight className="size-4" />
                        </button>
                      )}
                    </div>
                    {col.key === 'score' && (
                      <ScoreForm
                        id={c.id}
                        prevLevel={c.level}
                        mentoriaId={mentoriaId}
                        onDone={(msg) => {
                          setList((l) => l.filter((x) => x.id !== c.id));
                          toast(msg);
                          router.refresh();
                        }}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {done.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-bold text-muted uppercase">Concluídos hoje</p>
          <ul className="space-y-1.5">
            {done.map((d) => (
              <li key={d.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2">
                <span className={cn('size-2.5 shrink-0 rounded-full', LEVELS[Math.min(4, d.level)].dot)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{d.title}</span>
                  <span className="block text-[11px] text-muted">
                    {d.discipline} · {d.acc ?? 0}% de acerto · {d.level >= 4 ? 'assunto concluído' : d.due ? `volta em ${formatDate(d.due)}` : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ScoreForm({ id, prevLevel, mentoriaId, onDone }: { id: string; prevLevel: number; mentoriaId?: string; onDone: (msg: string) => void }) {
  const [q, setQ] = useState('');
  const [c, setC] = useState('');
  const [busy, setBusy] = useState(false);
  const total = Number(q) || 0;
  const right = Math.min(total, Number(c) || 0);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!total) return toast.error('Quantas questões você fez?');
    setBusy(true);
    const r = await scoreCard(id, total, right, mentoriaId);
    setBusy(false);
    if (r.error) return toast.error(r.error);
    const pct = r.acc ?? 0;
    onDone(
      r.level! >= 4
        ? `${pct}% — assunto concluído! 🎉`
        : pct >= PASS || prevLevel === 0
          ? `${pct}% de acerto. Próxima revisão em ${formatDate(r.due!)}`
          : `${pct}% de acerto. Vamos revisar de novo em ${formatDate(r.due!)}`,
    );
  }
  return (
    <form onSubmit={save} className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2 border-t border-line pt-3">
      <Input value={q} onChange={(e) => setQ(e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric" placeholder="Feitas" aria-label="Questões feitas" className="h-10" />
      <Input value={c} onChange={(e) => setC(e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric" placeholder="Acertos" aria-label="Acertos" className="h-10" />
      <button type="submit" disabled={busy} className={buttonClass('primary', 'sm', 'h-10')}>
        {busy ? <Spinner /> : 'Salvar'}
      </button>
    </form>
  );
}
