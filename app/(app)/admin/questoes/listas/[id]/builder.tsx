'use client';

import { ArrowDown, ArrowLeft, ArrowUp, ListChecks, Plus, Save, Send, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { QuestionCard, QuestionPicker } from '@/components/questoes/picker';
import { toast } from '@/components/toast';
import { Button, Input } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import type { AdminItem, ListTemplate } from '@/lib/question-lists';
import { cn } from '@/lib/utils';
import type { AudienceOptions } from '../../../ao-vivo/lives-manager';
import { itemsByIds } from '../../bank-actions';
import { saveList } from '../actions';
import { ApplyModal, DownloadMenu, TemplateSelect, type ListSummary } from '../lists-client';

/**
 * Montar a lista: 1) selecionar questões, 2) escolher o cabeçalho e rodapé, 3) salvar.
 * Dois ambientes: "Questões selecionadas" e "Selecionar questões" (abrir um recolhe o outro).
 */
export function Builder({
  initial,
  items: initialItems,
  templates,
  options,
  simulados,
}: {
  initial: ListSummary & { template_id: string | null };
  items: AdminItem[];
  templates: ListTemplate[];
  options: AudienceOptions;
  simulados: { id: string; title: string }[];
}) {
  const router = useRouter();
  const isNew = !initial.id;
  const [title, setTitle] = useState(initial.title);
  const [tpl, setTpl] = useState(initial.template_id ?? '');
  const [items, setItems] = useState<AdminItem[]>(initialItems);
  const [pane, setPane] = useState<'sel' | 'pick'>(isNew ? 'pick' : 'sel');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [apply, setApply] = useState(false);
  const ids = new Set(items.map((i) => i.id));
  const change = (fn: (l: AdminItem[]) => AdminItem[]) => {
    setItems(fn);
    setDirty(true);
  };

  const toggle = (it: AdminItem) => change((l) => (l.some((x) => x.id === it.id) ? l.filter((x) => x.id !== it.id) : [...l, it]));
  async function addMany(list: string[]) {
    const fresh = list.filter((i) => !ids.has(i));
    if (!fresh.length) return toast('Essas questões já estão na lista.');
    const got = await itemsByIds(fresh);
    change((l) => [...l, ...got]);
    toast(`${got.length} questões adicionadas`);
  }
  const move = (i: number, d: -1 | 1) =>
    change((l) => {
      const n = [...l];
      const j = i + d;
      if (j < 0 || j >= n.length) return l;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  async function save() {
    setBusy(true);
    const r = await saveList({ id: initial.id || undefined, title, question_ids: items.map((i) => i.id), template_id: tpl || null, mode: initial.mode }).catch(
      () => ({
        error: 'Não foi possível salvar.',
      }),
    );
    setBusy(false);
    if ('error' in r && r.error) return toast.error(r.error);
    const res = r as { id: string; updated?: number; locked?: number };
    setDirty(false);
    toast(
      `Lista salva${res.updated ? ` · ${res.updated} simulado(s) atualizado(s)` : ''}${res.locked ? ` · ${res.locked} simulado(s) já respondido(s) não mudaram` : ''}`,
    );
    if (isNew) router.replace(`/admin/questoes/listas/${res.id}`);
    else router.refresh();
  }

  const step = !items.length ? 1 : !tpl && pane === 'pick' ? 1 : dirty || isNew ? 2 : 3;

  return (
    <div className="pb-28">
      <Link href="/admin/questoes/listas" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Listas
      </Link>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setDirty(true);
          }}
          placeholder="Nome da lista (ex.: Lista 3 – Cinemática)"
          aria-label="Nome da lista"
          className="h-12 min-w-0 flex-1 text-base font-bold"
        />
        {!isNew && (
          <>
            <DownloadMenu id={initial.id} title={title} />
            <Button size="sm" onClick={() => setApply(true)} disabled={dirty}>
              <Send className="size-4" /> Aplicar
            </Button>
          </>
        )}
      </div>

      {/* passo a passo */}
      <ol className="mb-4 grid grid-cols-3 gap-1.5 text-center text-[11px] font-semibold">
        {['Selecionar questões', 'Cabeçalho', 'Salvar'].map((s, i) => (
          <li
            key={s}
            className={cn(
              'rounded-lg border px-1 py-1.5',
              step > i + 1 ? 'border-success/40 text-success' : step === i + 1 ? 'border-brand bg-brand/8 text-brand' : 'border-line text-muted',
            )}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      {/* celular: abrir um ambiente recolhe o outro; tablet e computador: os dois lado a lado */}
      <div className="sticky top-[102px] z-20 -mx-4 mb-3 grid grid-cols-2 md:hidden gap-1 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:top-[46px] lg:-mx-10 lg:px-10">
        <button
          type="button"
          onClick={() => setPane('sel')}
          aria-pressed={pane === 'sel'}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[13px] font-bold whitespace-nowrap transition sm:text-sm',
            pane === 'sel' ? 'bg-brand text-white' : 'text-ink-2 hover:bg-surface-2',
          )}
        >
          <ListChecks className="size-4" /> Selecionadas ({items.length})
        </button>
        <button
          type="button"
          onClick={() => setPane('pick')}
          aria-pressed={pane === 'pick'}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[13px] font-bold whitespace-nowrap transition sm:text-sm',
            pane === 'pick' ? 'bg-brand text-white' : 'text-ink-2 hover:bg-surface-2',
          )}
        >
          <Plus className="size-4" /> Selecionar questões
        </button>
      </div>

      <div className="md:grid md:grid-cols-2 md:gap-4">
        <section
          className={cn('min-w-0 space-y-2 md:block md:max-h-[calc(100dvh-230px)] md:overflow-y-auto md:pr-1', pane !== 'sel' && 'hidden')}
          aria-label="Questões selecionadas"
        >
          <h2 className="hidden items-center gap-1.5 pb-1 text-sm font-bold text-ink md:flex">
            <ListChecks className="size-4 text-brand" /> Questões selecionadas ({items.length})
          </h2>
          {items.map((it, i) => (
            <QuestionCard
              key={it.id}
              item={it}
              n={i + 1}
              actions={
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={!i}
                    aria-label="Subir"
                    className="grid size-7 place-items-center rounded-lg text-muted hover:bg-surface-2 disabled:opacity-30"
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === items.length - 1}
                    aria-label="Descer"
                    className="grid size-7 place-items-center rounded-lg text-muted hover:bg-surface-2 disabled:opacity-30"
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggle(it)}
                    aria-label="Tirar da lista"
                    className="grid size-7 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              }
            />
          ))}
          {!items.length && (
            <div className="rounded-2xl border border-dashed border-line-strong p-8 text-center">
              <p className="text-sm text-muted">Nenhuma questão na lista.</p>
              <Button size="sm" className="mt-3 md:hidden" onClick={() => setPane('pick')}>
                <Plus className="size-4" /> Selecionar questões
              </Button>
            </div>
          )}
        </section>

        <section
          className={cn('min-w-0 md:block md:max-h-[calc(100dvh-230px)] md:overflow-y-auto md:pr-1', pane !== 'pick' && 'hidden')}
          aria-label="Selecionar questões"
        >
          <h2 className="hidden items-center gap-1.5 pb-3 text-sm font-bold text-ink md:flex">
            <Plus className="size-4 text-brand" /> Selecionar questões
          </h2>
          <QuestionPicker selected={ids} onToggle={toggle} onMany={(l) => void addMany(l)} manyLabel="Adicionar todas" />
        </section>
      </div>

      {/* cabeçalho e salvar sempre à mão */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur-xl lg:bottom-0 lg:left-64">
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          <div className="min-w-0 flex-1">
            <TemplateSelect
              templates={templates}
              value={tpl}
              onChange={(v) => {
                setTpl(v);
                setDirty(true);
              }}
            />
          </div>
          <Button onClick={save} disabled={busy || !items.length || !title.trim() || (!dirty && !isNew)} className="shrink-0">
            {busy ? <Spinner /> : <Save className="size-4" />} {dirty || isNew ? 'Salvar' : 'Salvo'}
          </Button>
        </div>
      </div>

      {apply && <ApplyModal list={{ ...initial, title, count: items.length }} options={options} simulados={simulados} onClose={() => setApply(false)} />}
    </div>
  );
}
