'use client';

import { Check, Flame, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from '@/components/toast';
import { buttonClass, Input } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import { setPlanAssuntos } from '@/app/(app)/mentoria/actions';
import { DISCIPLINES } from '@/lib/enem-matriz';
import { cn } from '@/lib/utils';

/** Mentor marca e desmarca os assuntos do cronograma (manual ou ajustando o que foi gerado). */
export function AssuntoPicker({ mentoriaId, selected }: { mentoriaId: string; selected: string[] }) {
  const router = useRouter();
  const [sel, setSel] = useState(() => new Set(selected));
  const [disc, setDisc] = useState(DISCIPLINES[0].key);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const term = q.trim().toLowerCase();
  const original = useMemo(() => new Set(selected), [selected]);
  const added = [...sel].filter((k) => !original.has(k)).length;
  const removed = [...original].filter((k) => !sel.has(k)).length;

  const toggle = (keys: string[], on: boolean) =>
    setSel((s) => {
      const n = new Set(s);
      keys.forEach((k) => (on ? n.add(k) : n.delete(k)));
      return n;
    });

  async function save() {
    setBusy(true);
    const r = await setPlanAssuntos([...sel], mentoriaId);
    setBusy(false);
    if (r.error) return toast.error(r.error);
    toast(`Assuntos salvos (+${r.added} / −${r.removed}). Cronograma refeito.`);
    router.refresh();
  }

  const list = term ? DISCIPLINES : DISCIPLINES.filter((d) => d.key === disc);

  return (
    <div className="space-y-3">
      <div className="rail -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {DISCIPLINES.map((d) => {
          const n = d.blocks.flatMap((b) => b.items).filter((i) => sel.has(i.key)).length;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => {
                setDisc(d.key);
                setQ('');
              }}
              className={cn('shrink-0 rounded-xl border px-3 py-1.5 text-sm font-semibold', disc === d.key && !term ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-2')}
            >
              {d.name} <span className="text-xs opacity-75">{n}</span>
            </button>
          );
        })}
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar assunto em todas as disciplinas" className="pl-10" />
      </div>
      <div className="scrollbar-thin max-h-[55dvh] space-y-3 overflow-y-auto pr-1">
        {list.map((d) =>
          d.blocks.map((b) => {
            const items = b.items.filter((i) => !term || i.title.toLowerCase().includes(term) || b.title.toLowerCase().includes(term));
            if (!items.length) return null;
            const all = items.every((i) => sel.has(i.key));
            return (
              <section key={d.key + b.title} className="overflow-hidden rounded-xl border border-line">
                <div className="flex items-center justify-between gap-2 bg-surface-2/60 px-3 py-2">
                  <p className="text-xs font-bold text-ink-2">
                    {term && `${d.name} · `}
                    {b.title}
                  </p>
                  <button type="button" onClick={() => toggle(items.map((i) => i.key), !all)} className="text-[11px] font-semibold text-brand">
                    {all ? 'Desmarcar todos' : 'Marcar todos'}
                  </button>
                </div>
                <ul className="divide-y divide-line">
                  {items.map((i) => {
                    const on = sel.has(i.key);
                    return (
                      <li key={i.key}>
                        <button type="button" onClick={() => toggle([i.key], !on)} aria-pressed={on} className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-surface-2">
                          <span className={cn('grid size-5 shrink-0 place-items-center rounded-md border-2', on ? 'border-brand bg-brand text-white' : 'border-line-strong')}>
                            {on && <Check className="size-3.5" strokeWidth={3} />}
                          </span>
                          <span className="min-w-0 flex-1 text-[13px] text-ink">{i.title}</span>
                          {i.priority >= 3 && <Flame className="size-3.5 shrink-0 text-orange-500" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          }),
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={busy || (!added && !removed)} className={buttonClass('primary', 'md')}>
          {busy && <Spinner />} Salvar assuntos ({sel.size})
        </button>
        {(added > 0 || removed > 0) && (
          <span className="text-xs text-muted">
            +{added} entram · −{removed} saem
          </span>
        )}
      </div>
    </div>
  );
}
