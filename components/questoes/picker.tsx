'use client';

import 'katex/dist/katex.min.css';
import { Check, ChevronDown, Eye, EyeOff, Filter, ListPlus, Plus, Search, X } from 'lucide-react';
import { taxOrder } from '@/lib/taxonomy';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { bankOptions, idsForFilter, previewQuestion, searchBank } from '@/app/(app)/admin/questoes/bank-actions';
import { toast } from '@/components/toast';
import { Badge, Button, Field, Input, Select } from '@/components/ui';
import { Modal, Spinner } from '@/components/ui-client';
import { DIFFICULTY, difficultyOf, vestLabel, vestYear } from '@/lib/question-types';
import type { AdminFilters, AdminItem } from '@/lib/question-lists';
import { cn } from '@/lib/utils';

type Opt = Awaited<ReturnType<typeof bankOptions>>[number];

/** De onde vêm as questões: o admin usa as ações dele (prévia com gabarito); o aluno, as dele (sem gabarito). */
export interface PickerApi {
  search: typeof searchBank;
  ids: typeof idsForFilter;
  options: typeof bankOptions;
  preview: (id: string) => Promise<{ html: string; gabarito?: string; resolucao?: string } | null>;
  /** filtros que não aparecem (o aluno não filtra por ano nem por banca) */
  hide?: (keyof AdminFilters)[];
}
const ApiCtx = createContext<PickerApi>({ search: searchBank, ids: idsForFilter, options: bankOptions, preview: previewQuestion });
export const PickerApiProvider = ApiCtx.Provider;

export const plainText = (s: string) =>
  s
    .replace(/\$([^$]*)\$/g, '$1')
    .replace(/\\[a-z]+\{([^{}]*)\}/gi, '$1')
    .replace(/[*_`#>\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const FILTERS: { key: keyof AdminFilters; label: string }[] = [
  { key: 'vestibular', label: 'Vestibular' },
  { key: 'disciplina', label: 'Disciplina' },
  { key: 'area', label: 'Área do conhecimento' },
  { key: 'banca', label: 'Banca' },
  { key: 'ano', label: 'Ano' },
  { key: 'habilidade', label: 'Habilidade' },
  { key: 'assunto', label: 'Assunto geral' },
  { key: 'especifico', label: 'Assunto específico' },
  { key: 'texto', label: 'Trecho' },
];

/** Uma questão do banco: dados, prévia completa (com gabarito) e o botão de escolher. */
export function QuestionCard({
  item,
  n,
  picked,
  onPick,
  pickLabel = 'Escolher',
  actions,
}: {
  item: AdminItem;
  n?: number;
  picked?: boolean;
  onPick?: () => void;
  pickLabel?: string;
  actions?: React.ReactNode;
}) {
  const api = useContext(ApiCtx);
  const [prev, setPrev] = useState<{ html: string; gabarito?: string; resolucao?: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const dif = difficultyOf(item.param_b);
  async function toggle() {
    if (!open && !prev) {
      setBusy(true);
      setPrev(await api.preview(item.id).catch(() => null));
      setBusy(false);
    }
    setOpen((o) => !o);
  }
  return (
    <div className={cn('rounded-2xl border bg-surface p-3 transition', picked ? 'border-brand/60 bg-brand/5' : 'border-line')}>
      <div className="flex gap-3">
        {onPick ? (
          <button
            type="button"
            onClick={onPick}
            aria-pressed={picked}
            aria-label={picked ? 'Tirar da seleção' : pickLabel}
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-xl border transition',
              picked ? 'border-brand bg-brand text-white' : 'border-line-strong text-ink-2 hover:bg-surface-2',
            )}
          >
            {picked ? <Check className="size-4" /> : <Plus className="size-4" />}
          </button>
        ) : (
          n !== undefined && <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-3 text-sm font-bold text-ink-2">{n}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold break-words text-ink">
            {item.disciplina} · {item.assunto_geral}
          </p>
          {item.assunto_especifico && <p className="text-xs break-words text-ink-2">{item.assunto_especifico}</p>}
          {!open && <p className="mt-1 line-clamp-2 text-xs text-muted">{plainText(item.snippet)}</p>}
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Badge className="max-w-full whitespace-normal">{vestYear(item)}</Badge>
            {item.habilidade && <Badge>{item.habilidade}</Badge>}
            {dif && <Badge tone={dif === 'dificil' ? 'danger' : dif === 'media' ? 'warning' : 'success'}>{DIFFICULTY.find((d) => d.key === dif)!.label}</Badge>}
            {item.status === 'anulada' && <Badge tone="danger">Anulada</Badge>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <button type="button" onClick={toggle} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-brand hover:bg-brand/8">
            {busy ? <Spinner /> : open ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} {open ? 'Fechar' : 'Ver'}
          </button>
          {actions}
        </div>
      </div>
      {open && prev && (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          <div className="qprev" dangerouslySetInnerHTML={{ __html: prev.html }} />
          {prev.gabarito && <p className="text-xs font-bold text-success">Gabarito: {prev.gabarito}</p>}
          {prev.resolucao && (
            <div className="rounded-xl border border-line bg-surface p-3">
              <p className="mb-1.5 text-[11px] font-bold tracking-wider text-brand uppercase">Resolução</p>
              <div className="q-rich text-[13px] text-ink-2" dangerouslySetInnerHTML={{ __html: prev.resolucao }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Questões disponíveis no banco, com os filtros num popup (habilidade, assunto geral e específico,
 * disciplina, banca, área, ano e trecho do enunciado). Serve para montar listas e para excluir em lote.
 */
export function QuestionPicker({
  selected,
  onToggle,
  onMany,
  manyLabel = 'Escolher todas',
}: {
  selected: Set<string>;
  onToggle: (item: AdminItem) => void;
  onMany: (ids: string[]) => void;
  manyLabel?: string;
}) {
  const api = useContext(ApiCtx);
  const [opts, setOpts] = useState<Opt[]>([]);
  const [f, setF] = useState<AdminFilters>({});
  const [draft, setDraft] = useState<AdminFilters>({});
  const [show, setShow] = useState(false);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(true);
  const [many, setMany] = useState(false);

  useEffect(() => {
    api
      .options()
      .then(setOpts)
      .catch(() => {});
  }, []);
  useEffect(() => {
    let off = false;
    setBusy(true);
    api
      .search(f, page)
      .then((r) => {
        if (off) return;
        setItems((l) => (page === 1 ? r.items : [...l, ...r.items]));
        setTotal(r.total);
      })
      .catch(() => toast.error('Não foi possível buscar as questões.'))
      .finally(() => !off && setBusy(false));
    return () => {
      off = true;
    };
  }, [f, page]);

  // opções de cada filtro, respeitando os outros já escolhidos no popup
  const optionsFor = useMemo(
    () => (key: keyof AdminFilters) => {
      const col = {
        vestibular: 'vestibular',
        disciplina: 'disciplina',
        area: 'area',
        banca: 'banca',
        ano: 'ano',
        habilidade: 'habilidade',
        assunto: 'assunto_geral',
        especifico: 'assunto_especifico',
      }[key as string] as keyof Opt | undefined;
      if (!col) return [];
      const rows = opts.filter((o) =>
        (['vestibular', 'disciplina', 'area', 'banca', 'ano', 'habilidade', 'assunto'] as const).every((k) => {
          if (k === key || !draft[k]) return true;
          const c = (
            { vestibular: 'vestibular', disciplina: 'disciplina', area: 'area', banca: 'banca', ano: 'ano', habilidade: 'habilidade', assunto: 'assunto_geral' } as const
          )[k] as keyof Opt;
          return String(o[c] ?? '') === draft[k];
        }),
      );
      const vals = [...new Set(rows.map((o) => String(o[col] ?? '')).filter(Boolean))];
      // assunto e subassunto na ordem da taxonomia do curso
      if (key === 'assunto' || key === 'especifico') return taxOrder(vals);
      return vals.sort((a, b) => (key === 'ano' ? Number(b) - Number(a) : a.localeCompare(b, 'pt-BR', { numeric: true })));
    },
    [opts, draft],
  );

  const active = Object.entries(f).filter(([, v]) => v);
  const apply = (next: AdminFilters) => {
    setPage(1);
    setF(next);
  };

  async function selectAll() {
    setMany(true);
    try {
      onMany(await api.ids(f));
    } finally {
      setMany(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setDraft(f);
            setShow(true);
          }}
        >
          <Filter className="size-4" /> Filtros{active.length ? ` (${active.length})` : ''}
        </Button>
        <span className="text-xs text-muted">{busy && page === 1 ? 'Buscando…' : `${total} ${total === 1 ? 'questão' : 'questões'}`}</span>
        {total > 0 && (
          <Button variant="ghost" size="sm" onClick={selectAll} disabled={many} className="ml-auto">
            {many ? <Spinner /> : <ListPlus className="size-4" />} {manyLabel} ({total})
          </Button>
        )}
      </div>
      {active.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {active.map(([k, v]) => (
            <button
              key={k}
              type="button"
              onClick={() => apply({ ...f, [k]: '' })}
              className="flex max-w-full items-center gap-1 rounded-lg bg-brand/12 px-2 py-1 text-left text-[11px] font-semibold break-words text-brand"
            >
              {FILTERS.find((x) => x.key === k)?.label}: {k === 'vestibular' ? vestLabel(String(v)) : v} <X className="size-3 shrink-0" />
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {items.map((it) => (
          <QuestionCard key={it.id} item={it} picked={selected.has(it.id)} onPick={() => onToggle(it)} />
        ))}
        {!busy && !items.length && (
          <p className="rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">Nenhuma questão com esses filtros.</p>
        )}
        {items.length < total && (
          <Button variant="secondary" onClick={() => setPage((p) => p + 1)} disabled={busy} className="w-full">
            {busy ? <Spinner /> : <ChevronDown className="size-4" />} Mostrar mais
          </Button>
        )}
      </div>

      <Modal
        open={show}
        onClose={() => setShow(false)}
        title="Filtros"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft({})}>
              Limpar
            </Button>
            <Button
              onClick={() => {
                apply(draft);
                setShow(false);
              }}
            >
              Aplicar
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {FILTERS.filter((x) => x.key !== 'texto' && !api.hide?.includes(x.key)).map((x) => (
            <Field
              key={x.key}
              label={x.label}
              hint={x.key === 'especifico' && !(draft.disciplina && draft.assunto) ? 'Escolha uma disciplina e um assunto geral primeiro.' : undefined}
            >
              <Select
                disabled={x.key === 'especifico' && !(draft.disciplina && draft.assunto)}
                value={draft[x.key] ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft((d) => ({
                    ...d,
                    [x.key]: v,
                    ...(x.key === 'disciplina' ? { assunto: '', especifico: '' } : x.key === 'assunto' ? { especifico: '' } : {}),
                  }));
                }}
                aria-label={x.label}
                className="min-w-0"
              >
                <option value="">{x.key === 'vestibular' ? 'Todos (misturados)' : 'Todos'}</option>
                {optionsFor(x.key).map((v) => (
                  <option key={v} value={v}>
                    {x.key === 'vestibular' ? vestLabel(v) : v}
                  </option>
                ))}
              </Select>
            </Field>
          ))}
          <Field label="Trecho da questão" className="sm:col-span-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <Input
                value={draft.texto ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, texto: e.target.value }))}
                placeholder="Palavras do enunciado ou das alternativas"
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
