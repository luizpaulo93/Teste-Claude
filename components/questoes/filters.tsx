'use client';

import { Search, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Input, Select } from '@/components/ui';
import { DIFFICULTY } from '@/lib/question-types';

export interface FilterState {
  disciplina?: string;
  assunto?: string;
  prova?: string;
  dif?: string;
  sit?: string;
  q?: string;
  topico?: string;
}

/** Filtros do banco de questões (cada mudança atualiza a lista). */
export function QuestionFilters({
  value,
  disc,
  papers,
}: {
  value: FilterState;
  disc: { disciplina: string; assunto_geral: string; n: number }[];
  papers: { id: string; label: string }[];
}) {
  const router = useRouter();
  const path = usePathname();
  const [q, setQ] = useState(value.q ?? '');
  const go = (patch: Partial<FilterState>) => {
    const next = { ...value, ...patch };
    if ('disciplina' in patch) next.assunto = '';
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    router.push(`${path}${p.size ? `?${p}` : ''}`);
  };
  const disciplinas = [...new Set(disc.map((d) => d.disciplina))];
  const assuntos = disc.filter((d) => !value.disciplina || d.disciplina === value.disciplina);
  const any = Object.values(value).some(Boolean);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5 [&>*]:min-w-0">
        <Select value={value.disciplina ?? ''} onChange={(e) => go({ disciplina: e.target.value })} aria-label="Disciplina" className="min-w-0">
          <option value="">Todas as disciplinas</option>
          {disciplinas.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
        <Select value={value.assunto ?? ''} onChange={(e) => go({ assunto: e.target.value })} aria-label="Assunto" className="min-w-0">
          <option value="">Todos os assuntos</option>
          {assuntos.map((a) => (
            <option key={`${a.disciplina}-${a.assunto_geral}`} value={a.assunto_geral}>
              {value.disciplina ? '' : `${a.disciplina}: `}
              {a.assunto_geral} ({a.n})
            </option>
          ))}
        </Select>
        <Select value={value.prova ?? ''} onChange={(e) => go({ prova: e.target.value })} aria-label="Prova" className="min-w-0">
          <option value="">Todas as provas</option>
          {papers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </Select>
        <Select value={value.dif ?? ''} onChange={(e) => go({ dif: e.target.value })} aria-label="Dificuldade" className="min-w-0">
          <option value="">Qualquer dificuldade</option>
          {DIFFICULTY.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
        </Select>
        <Select value={value.sit ?? ''} onChange={(e) => go({ sit: e.target.value })} aria-label="Situação" className="col-span-2 min-w-0 lg:col-span-1">
          <option value="">Todas as questões</option>
          <option value="nao">Não respondidas</option>
          <option value="erradas">Que errei</option>
          <option value="certas">Que acertei</option>
        </Select>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: q.trim() });
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar assunto ou habilidade (ex.: H19)" className="pl-9" aria-label="Buscar" />
        </div>
        {any && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              router.push(path);
            }}
            className="flex shrink-0 items-center gap-1 rounded-xl px-3 text-xs font-semibold text-muted hover:text-ink"
          >
            <X className="size-3.5" /> Limpar
          </button>
        )}
      </form>
    </div>
  );
}
