'use client';

import { Filter, Search, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button, Field, Input, Select } from '@/components/ui';
import { Modal } from '@/components/ui-client';
import { DIFFICULTY } from '@/lib/question-types';

export interface FilterState {
  disciplina?: string;
  assunto?: string;
  especifico?: string;
  habilidade?: string;
  ano?: string;
  prova?: string;
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

/** Filtros do banco de questões num popup (botão "Filtros"); os escolhidos aparecem como etiquetas. */
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
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    router.push(`${path}${p.size ? `?${p}` : ''}`);
  };

  // opções de cada campo respeitando o que já foi escolhido nos outros
  const opts = useMemo(() => {
    const match = (r: FilterRowView, skip: string) =>
      (skip === 'disciplina' || !d.disciplina || r.disciplina === d.disciplina) &&
      (skip === 'assunto' || !d.assunto || r.assunto_geral === d.assunto) &&
      (skip === 'especifico' || !d.especifico || r.assunto_especifico === d.especifico) &&
      (skip === 'habilidade' || !d.habilidade || r.habilidade === d.habilidade) &&
      (skip === 'ano' || !d.ano || String(r.ano) === d.ano) &&
      (skip === 'prova' || !d.prova || r.paper_id === d.prova);
    const uniq = (skip: string, get: (r: FilterRowView) => string) =>
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
      assunto: uniq('assunto', (r) => r.assunto_geral),
      especifico: uniq('especifico', (r) => r.assunto_especifico),
      habilidade: uniq('habilidade', (r) => r.habilidade),
      ano: uniq('ano', (r) => (r.ano ? String(r.ano) : '')).reverse(),
      prova: new Set(rows.filter((r) => match(r, 'prova')).map((r) => r.paper_id)),
    };
  }, [rows, d]);

  const active = (Object.keys(LABELS) as (keyof FilterState)[]).filter((k) => value[k] && k !== 'topico');
  const show = (k: keyof FilterState, v: string) =>
    k === 'prova' ? (papers.find((p) => p.id === v)?.label ?? v) : k === 'dif' ? (DIFFICULTY.find((x) => x.key === v)?.label ?? v) : k === 'sit' ? SIT[v] : v;
  const pick = (k: keyof FilterState, v: string) =>
    setD((o) => ({
      ...o,
      [k]: v,
      ...(k === 'disciplina' ? { assunto: '', especifico: '' } : k === 'assunto' ? { especifico: '' } : {}),
    }));

  const sel = (k: 'disciplina' | 'assunto' | 'especifico' | 'habilidade' | 'ano', all: string) => (
    <Field label={LABELS[k]}>
      <Select value={d[k] ?? ''} onChange={(e) => pick(k, e.target.value)} aria-label={LABELS[k]} className="min-w-0">
        <option value="">{all}</option>
        {opts[k].map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </Select>
    </Field>
  );

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
          <Filter className="size-4" /> Filtros{active.length ? ` (${active.length})` : ''}
        </Button>
        <span className="text-xs text-muted">
          {total} {total === 1 ? 'questão' : 'questões'}
        </span>
        {active.length > 0 && (
          <button type="button" onClick={() => go({})} className="ml-auto text-xs font-semibold text-muted hover:text-ink">
            Limpar
          </button>
        )}
      </div>
      {active.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {active.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => go({ ...value, [k]: '', ...(k === 'disciplina' ? { assunto: '', especifico: '' } : k === 'assunto' ? { especifico: '' } : {}) })}
              className="flex max-w-full items-center gap-1 rounded-lg bg-brand/12 px-2 py-1 text-left text-[11px] font-semibold break-words text-brand"
            >
              {LABELS[k]}: {show(k, value[k]!)} <X className="size-3 shrink-0" />
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
            <Button variant="ghost" onClick={() => setD({})}>
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
        <div className="grid gap-3 sm:grid-cols-2">
          {sel('disciplina', 'Todas')}
          {sel('assunto', 'Todos')}
          <div className="sm:col-span-2">{sel('especifico', 'Todos')}</div>
          {sel('habilidade', 'Todas')}
          {sel('ano', 'Todos')}
          <Field label="Prova" className="sm:col-span-2">
            <Select value={d.prova ?? ''} onChange={(e) => pick('prova', e.target.value)} aria-label="Prova" className="min-w-0">
              <option value="">Todas</option>
              {papers
                .filter((p) => opts.prova.has(p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Dificuldade">
            <Select value={d.dif ?? ''} onChange={(e) => pick('dif', e.target.value)} aria-label="Dificuldade" className="min-w-0">
              <option value="">Qualquer</option>
              {DIFFICULTY.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Situação">
            <Select value={d.sit ?? ''} onChange={(e) => pick('sit', e.target.value)} aria-label="Situação" className="min-w-0">
              <option value="">Todas</option>
              {Object.entries(SIT).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Trecho da questão" className="sm:col-span-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <Input
                value={d.q ?? ''}
                onChange={(e) => pick('q', e.target.value)}
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
