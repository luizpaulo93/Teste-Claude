'use client';

import { Check, ChevronDown, Filter, Search, X } from 'lucide-react';
import { taxOrder } from '@/lib/taxonomy';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button, Field, Input, Select } from '@/components/ui';
import { Modal } from '@/components/ui-client';
import { DIFFICULTY } from '@/lib/question-types';
import { cn } from '@/lib/utils';

type Multi = 'disciplina' | 'assunto' | 'especifico' | 'habilidade' | 'ano' | 'prova';
export interface FilterState {
  disciplina?: string[];
  assunto?: string[];
  especifico?: string[];
  habilidade?: string[];
  ano?: string[];
  prova?: string[];
  dif?: string;
  sit?: string;
  q?: string;
  topico?: string;
}

export interface FilterRowView {
  disciplina: string;
  assunto_geral: string;
  assunto_especifico: string;
  habilidade: string;
  ano: number | null;
  paper_id: string;
}

const LABELS: Record<keyof FilterState, string> = {
  disciplina: 'Disciplina',
  assunto: 'Assunto',
  especifico: 'Assunto específico',
  habilidade: 'Habilidade',
  ano: 'Ano',
  prova: 'Prova',
  dif: 'Dificuldade',
  sit: 'Situação',
  q: 'Trecho',
  topico: 'Assunto do cronograma',
};
const SIT: Record<string, string> = { nao: 'Não respondidas', erradas: 'Que errei', certas: 'Que acertei' };
const MULTI: Multi[] = ['disciplina', 'assunto', 'especifico', 'habilidade', 'ano', 'prova'];

export function toQuery(f: FilterState) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f))
    if (Array.isArray(v)) v.forEach((x) => p.append(k, x));
    else if (v) p.set(k, v);
  return p;
}

/** Campo de várias escolhas: abre a lista com caixas de marcar (com busca nas listas longas). */
/** Subassunto (assunto específico) só com exatamente uma disciplina e um assunto geral escolhidos. */
const subOk = (d: { disciplina?: string[]; assunto?: string[] }) => d.disciplina?.length === 1 && d.assunto?.length === 1;

export function MultiField({
  label,
  options,
  value,
  onChange,
  show = (v) => v,
  locked,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  show?: (v: string) => string;
  /** campo travado: mostra o aviso no lugar das opções */
  locked?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  // os já marcados aparecem mesmo se os outros filtros os esconderem
  const list = [...new Set([...value, ...options])].filter((v) => !term || show(v).toLowerCase().includes(term));
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  if (locked)
    return (
      <div className="rounded-xl border border-dashed border-line px-3 py-2.5" aria-disabled="true">
        <span className="text-xs font-semibold text-muted">{label}</span>
        <p className="mt-0.5 text-[11px] text-muted">{locked}</p>
      </div>
    );
  return (
    <div className="rounded-xl border border-line">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <span className="text-xs font-semibold text-ink-2">{label}</span>
        <span className="min-w-0 flex-1 truncate text-right text-xs text-muted">{value.length ? value.map(show).join(', ') : 'Todos'}</span>
        <ChevronDown className={cn('size-4 shrink-0 text-muted transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-line p-2">
          {options.length > 8 && (
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Buscar ${label.toLowerCase()}`}
                className="h-9 pl-9"
                aria-label={`Buscar ${label}`}
              />
            </div>
          )}
          <ul className="max-h-56 overflow-y-auto" role="group" aria-label={label}>
            {list.map((v) => {
              const on = value.includes(v);
              return (
                <li key={v}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(v)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13px] text-ink hover:bg-surface-2"
                  >
                    <span
                      className={cn('grid size-4.5 shrink-0 place-items-center rounded border', on ? 'border-brand bg-brand text-white' : 'border-line-strong')}
                    >
                      {on && <Check className="size-3" />}
                    </span>
                    <span className="min-w-0 flex-1 break-words">{show(v)}</span>
                  </button>
                </li>
              );
            })}
            {!list.length && <li className="px-2 py-3 text-center text-xs text-muted">Nada encontrado.</li>}
          </ul>
          {value.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="px-2 text-[11px] font-semibold text-muted hover:text-ink">
              Desmarcar todos
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Filtros do banco de questões num popup (botão "Filtros"); vários valores por campo; os escolhidos aparecem como etiquetas. */
export function QuestionFilters({
  value,
  rows,
  papers,
  total,
}: {
  value: FilterState;
  rows: FilterRowView[];
  papers: { id: string; label: string }[];
  total: number;
}) {
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<FilterState>(value);

  const go = (next: FilterState) => {
    const p = toQuery(next);
    router.push(`${path}${p.size ? `?${p}` : ''}`);
  };

  // opções de cada campo respeitando o que já foi escolhido nos outros
  const opts = useMemo(() => {
    const has = (list: string[] | undefined, v: string) => !list?.length || list.includes(v);
    const match = (r: FilterRowView, skip: Multi) =>
      (skip === 'disciplina' || has(d.disciplina, r.disciplina)) &&
      (skip === 'assunto' || has(d.assunto, r.assunto_geral)) &&
      (skip === 'especifico' || has(d.especifico, r.assunto_especifico)) &&
      (skip === 'habilidade' || has(d.habilidade, r.habilidade)) &&
      (skip === 'ano' || has(d.ano, String(r.ano))) &&
      (skip === 'prova' || has(d.prova, r.paper_id));
    const uniq = (skip: Multi, get: (r: FilterRowView) => string) =>
      [
        ...new Set(
          rows
            .filter((r) => match(r, skip))
            .map(get)
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
    return {
      disciplina: uniq('disciplina', (r) => r.disciplina),
      // na ordem da taxonomia do curso
      assunto: taxOrder(uniq('assunto', (r) => r.assunto_geral)),
      especifico: taxOrder(uniq('especifico', (r) => r.assunto_especifico)),
      habilidade: uniq('habilidade', (r) => r.habilidade),
      ano: uniq('ano', (r) => (r.ano ? String(r.ano) : '')).reverse(),
      prova: papers.map((p) => p.id).filter((id) => rows.some((r) => r.paper_id === id && match(r, 'prova'))),
    };
  }, [rows, d, papers]);

  const paperName = (id: string) => papers.find((p) => p.id === id)?.label ?? id;
  const chips = [
    ...MULTI.flatMap((k) => (value[k] ?? []).map((v) => ({ k: k as keyof FilterState, v, label: `${LABELS[k]}: ${k === 'prova' ? paperName(v) : v}` }))),
    ...(['dif', 'sit', 'q'] as const)
      .filter((k) => value[k])
      .map((k) => ({
        k: k as keyof FilterState,
        v: value[k]!,
        label: `${LABELS[k]}: ${k === 'dif' ? (DIFFICULTY.find((x) => x.key === value.dif)?.label ?? '') : k === 'sit' ? SIT[value.sit!] : value.q}`,
      })),
  ];
  const remove = (k: keyof FilterState, v: string) => go({ ...value, [k]: MULTI.includes(k as Multi) ? (value[k as Multi] ?? []).filter((x) => x !== v) : '' });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setD(value);
            setOpen(true);
          }}
        >
          <Filter className="size-4" /> Filtros{chips.length ? ` (${chips.length})` : ''}
        </Button>
        <span className="text-xs text-muted">
          {total} {total === 1 ? 'questão' : 'questões'}
        </span>
        {chips.length > 0 && (
          <button type="button" onClick={() => go({ topico: value.topico })} className="ml-auto text-xs font-semibold text-muted hover:text-ink">
            Limpar
          </button>
        )}
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button
              key={`${c.k}-${c.v}`}
              type="button"
              onClick={() => remove(c.k, c.v)}
              className="flex max-w-full items-center gap-1 rounded-lg bg-brand/12 px-2 py-1 text-left text-[11px] font-semibold break-words text-brand"
            >
              {c.label} <X className="size-3 shrink-0" />
            </button>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Filtros"
        footer={
          <>
            <Button variant="ghost" onClick={() => setD({ topico: value.topico })}>
              Limpar
            </Button>
            <Button
              onClick={() => {
                go({ ...d, topico: value.topico });
                setOpen(false);
              }}
            >
              Aplicar
            </Button>
          </>
        }
      >
        <div className="space-y-2.5">
          <p className="text-[11px] text-muted">Dá para marcar mais de um em cada campo.</p>
          {MULTI.map((k) => (
            <MultiField
              key={k}
              label={LABELS[k]}
              options={opts[k]}
              value={d[k] ?? []}
              show={k === 'prova' ? paperName : undefined}
              locked={k === 'especifico' && !subOk(d) ? 'Escolha uma disciplina e um assunto geral para ver os subassuntos.' : undefined}
              onChange={(v) =>
                setD((o) => {
                  const n = { ...o, [k]: v };
                  // subassunto só vale com uma disciplina e um assunto geral
                  return subOk(n) ? n : { ...n, especifico: [] };
                })
              }
            />
          ))}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <Field label="Dificuldade">
              <Select value={d.dif ?? ''} onChange={(e) => setD((o) => ({ ...o, dif: e.target.value }))} aria-label="Dificuldade" className="min-w-0">
                <option value="">Qualquer</option>
                {DIFFICULTY.map((x) => (
                  <option key={x.key} value={x.key}>
                    {x.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Situação">
              <Select value={d.sit ?? ''} onChange={(e) => setD((o) => ({ ...o, sit: e.target.value }))} aria-label="Situação" className="min-w-0">
                <option value="">Todas</option>
                {Object.entries(SIT).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Trecho da questão">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <Input
                value={d.q ?? ''}
                onChange={(e) => setD((o) => ({ ...o, q: e.target.value }))}
                placeholder="Palavras do enunciado, assunto ou habilidade (ex.: H19)"
                className="pl-9"
                aria-label="Trecho da questão"
              />
            </div>
          </Field>
        </div>
      </Modal>
    </div>
  );
}
