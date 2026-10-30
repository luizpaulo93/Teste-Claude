'use client';

import { Check, CheckCheck, ChevronDown, Circle, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from '@/components/toast';
import { Input } from '@/components/ui';
import { setTopicStatus } from '@/app/(app)/mentoria/actions';
import { itemKey, MATRIZ, type MatrizArea, type MatrizDiscipline } from '@/lib/enem-matriz';
import { cn } from '@/lib/utils';

const LABEL = ['Não estudado', 'Estudado', 'Dominado'];

/** Conteúdos da Matriz de Referência do ENEM por área e disciplina, com progresso do aluno. */
export function MatrizView({ initial, mentoriaId }: { initial: Record<string, number>; mentoriaId?: string }) {
  const [status, setStatus] = useState<Record<string, number>>(initial);
  const [area, setArea] = useState<MatrizArea['area']>('MT');
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();

  async function apply(keys: string[], value: 0 | 1 | 2) {
    const before = status;
    setStatus((s) => {
      const n = { ...s };
      for (const k of keys) {
        if (value) n[k] = Math.max(n[k] ?? 0, value);
        else delete n[k];
      }
      return n;
    });
    const r = await setTopicStatus(keys, value, mentoriaId).catch(() => ({ error: 'rede' }));
    if (r.error) {
      setStatus(before);
      toast.error('Não foi possível salvar.');
    }
  }

  const pct = (keys: string[]) => {
    if (!keys.length) return { done: 0, mastered: 0, total: 0 };
    return { done: keys.filter((k) => status[k]).length, mastered: keys.filter((k) => status[k] === 2).length, total: keys.length };
  };
  const keysOf = (d: MatrizDiscipline) => d.topics.flatMap((t, ti) => t.items.map((_, ii) => itemKey(d.key, ti, ii)));

  const current = MATRIZ.find((a) => a.area === area)!;
  const areas = useMemo(() => MATRIZ.map((a) => ({ a, p: pct(a.disciplines.flatMap(keysOf)) })), [status]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {areas.map(({ a, p }) => (
          <button
            key={a.area}
            type="button"
            onClick={() => setArea(a.area)}
            className={cn('rounded-2xl border p-3 text-left transition', area === a.area ? 'border-brand bg-brand/10' : 'border-line bg-surface hover:bg-surface-2')}
          >
            <p className="text-xs font-extrabold text-brand">{a.area}</p>
            <p className="line-clamp-2 min-h-8 text-[11px] leading-tight font-semibold text-ink">{a.name}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-success" style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%` }} />
            </div>
            <p className="mt-1 text-[10px] text-muted tabular-nums">
              {p.done}/{p.total} conteúdos
            </p>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar conteúdo (ex.: estequiometria, Leis de Newton)" className="pl-10" />
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-muted">
        <span className="flex items-center gap-1">
          <Circle className="size-3.5" /> não estudado
        </span>
        <span className="flex items-center gap-1">
          <Check className="size-3.5 text-brand" /> estudado
        </span>
        <span className="flex items-center gap-1">
          <CheckCheck className="size-3.5 text-success" /> dominado
        </span>
        <span>· toque para mudar</span>
      </div>

      {term && !MATRIZ.some((a) => hasMatch(a, term)) && <p className="rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">Nenhum conteúdo encontrado.</p>}
      {(term ? MATRIZ.filter((a) => hasMatch(a, term)) : [current]).map((a) => (
        <div key={a.area} className="space-y-3">
          {term && <p className="text-xs font-bold tracking-wide text-muted uppercase">{a.name}</p>}
          {a.disciplines.map((d) => {
            const topics = d.topics
              .map((t, ti) => ({ t, ti, items: t.items.map((text, ii) => ({ text, ii })).filter((x) => !term || x.text.toLowerCase().includes(term) || t.title.toLowerCase().includes(term)) }))
              .filter((x) => x.items.length);
            if (!topics.length) return null;
            const p = pct(keysOf(d));
            return (
              <details key={d.key} open={Boolean(term) || a.disciplines.length === 1} className="group overflow-hidden rounded-2xl border border-line bg-surface">
                <summary className="flex cursor-pointer list-none items-center gap-3 p-4 select-none [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ink">{d.name}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                        <div className="h-full rounded-full bg-success" style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%` }} />
                      </div>
                      <span className="shrink-0 text-[11px] text-muted tabular-nums">
                        {p.done}/{p.total}
                        {p.mastered ? ` · ${p.mastered} dominados` : ''}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" />
                </summary>
                <div className="space-y-2 border-t border-line p-3">
                  {topics.map(({ t, ti, items }) => {
                    const keys = t.items.map((_, ii) => itemKey(d.key, ti, ii));
                    const tp = pct(keys);
                    const allDone = tp.done === tp.total;
                    return (
                      <details key={ti} open={Boolean(term)} className="group/t rounded-xl border border-line bg-surface-2/40">
                        <summary className="flex cursor-pointer list-none items-start gap-2 px-3 py-2.5 select-none [&::-webkit-details-marker]:hidden">
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-ink">{t.title}</span>
                            {t.subtitle && <span className="block text-[11px] text-muted">{t.subtitle}</span>}
                          </span>
                          <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums', allDone ? 'bg-success/15 text-success' : 'bg-surface-3 text-muted')}>
                            {tp.done}/{tp.total}
                          </span>
                          <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted transition-transform group-open/t:rotate-180" />
                        </summary>
                        <ul className="space-y-1 px-2 pb-2">
                          {items.map(({ text, ii }) => {
                            const k = itemKey(d.key, ti, ii);
                            const s = status[k] ?? 0;
                            return (
                              <li key={ii}>
                                <button
                                  type="button"
                                  onClick={() => apply([k], ((s + 1) % 3) as 0 | 1 | 2)}
                                  aria-label={`${text}: ${LABEL[s]}`}
                                  className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-surface"
                                >
                                  {s === 2 ? (
                                    <CheckCheck className="mt-0.5 size-4 shrink-0 text-success" />
                                  ) : s === 1 ? (
                                    <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                                  ) : (
                                    <Circle className="mt-0.5 size-4 shrink-0 text-line-strong" />
                                  )}
                                  <span className={cn('text-[13px] leading-snug', s ? 'text-ink' : 'text-ink-2')}>{text}</span>
                                </button>
                              </li>
                            );
                          })}
                          <li className="flex justify-end pt-1">
                            <button type="button" onClick={() => apply(keys, allDone ? 0 : 1)} className="text-[11px] font-semibold text-brand">
                              {allDone ? 'Desmarcar tópico' : 'Marcar tópico todo como estudado'}
                            </button>
                          </li>
                        </ul>
                      </details>
                    );
                  })}
                </div>
              </details>
            );
          })}
          {a.area === 'CH' && !term && <p className="text-[11px] text-muted">Na matriz oficial, Ciências Humanas vem por eixos temáticos. Aqui cada conteúdo foi colocado na disciplina mais próxima.</p>}
        </div>
      ))}
    </div>
  );
}

function hasMatch(a: MatrizArea, term: string) {
  return a.disciplines.some((d) => d.topics.some((t) => t.title.toLowerCase().includes(term) || t.items.some((i) => i.toLowerCase().includes(term))));
}
