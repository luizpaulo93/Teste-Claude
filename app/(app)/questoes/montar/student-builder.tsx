'use client';

import { ArrowLeft, ListChecks, Plus, Save, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PickerApiProvider, QuestionCard, QuestionPicker, type PickerApi } from '@/components/questoes/picker';
import { toast } from '@/components/toast';
import { Button, Input } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import type { AdminItem } from '@/lib/question-lists';
import { cn } from '@/lib/utils';
import { idsStudent, itemsStudent, optionsStudent, previewStudent, saveMyList, searchStudent } from '../aluno-actions';

// o aluno usa as buscas dele: a prévia não mostra o gabarito
const API: PickerApi = { search: searchStudent, ids: idsStudent, options: optionsStudent, preview: previewStudent, hide: ['ano', 'banca'] };

/** O aluno escolhe questão por questão (com filtros), dá um nome e salva a lista. */
export function StudentBuilder() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [items, setItems] = useState<AdminItem[]>([]);
  const [pane, setPane] = useState<'sel' | 'pick'>('pick');
  const [busy, setBusy] = useState(false);
  const ids = new Set(items.map((i) => i.id));
  const toggle = (it: AdminItem) => setItems((l) => (l.some((x) => x.id === it.id) ? l.filter((x) => x.id !== it.id) : [...l, it]));
  async function addMany(list: string[]) {
    const fresh = list.filter((i) => !ids.has(i)).slice(0, 150 - items.length);
    if (!fresh.length) return toast('Essas questões já estão na lista.');
    const got = await itemsStudent(fresh);
    setItems((l) => [...l, ...got]);
    toast(`${got.length} questões adicionadas`);
  }
  async function save() {
    if (!title.trim()) return toast.error('Dê um nome para a lista.');
    setBusy(true);
    const r = await saveMyList({ title, ids: items.map((i) => i.id) }).catch(() => ({ error: 'Não foi possível salvar.' }));
    setBusy(false);
    if ('error' in r && r.error) return toast.error(r.error);
    toast('Lista salva');
    router.push(`/listas/${(r as { id: string }).id}`);
  }

  return (
    <PickerApiProvider value={API}>
      <div className="pb-28">
        <Link href="/questoes" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Exercícios
        </Link>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nome da lista (ex.: Revisão de Ondulatória)"
          aria-label="Nome da lista"
          maxLength={120}
          className="mb-4 h-12 text-base font-bold"
        />

        {/* celular: abrir um recolhe o outro; tablet e computador: lado a lado */}
        <div className="sticky top-14 z-20 -mx-4 mb-3 grid grid-cols-2 gap-1 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur-xl md:hidden">
          {(
            [
              ['sel', `Selecionadas (${items.length})`, ListChecks],
              ['pick', 'Selecionar questões', Plus],
            ] as const
          ).map(([k, l, Icon]) => (
            <button
              key={k}
              type="button"
              onClick={() => setPane(k)}
              aria-pressed={pane === k}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[13px] font-bold whitespace-nowrap transition',
                pane === k ? 'bg-brand text-white' : 'text-ink-2 hover:bg-surface-2',
              )}
            >
              <Icon className="size-4" /> {l}
            </button>
          ))}
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
                  <button
                    type="button"
                    onClick={() => toggle(it)}
                    aria-label="Tirar da lista"
                    className="grid size-7 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
                  >
                    <X className="size-3.5" />
                  </button>
                }
              />
            ))}
            {!items.length && (
              <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-sm text-muted">Nenhuma questão escolhida ainda.</p>
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

        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur-xl lg:bottom-0 lg:left-64">
          <div className="mx-auto flex max-w-5xl items-center gap-2">
            <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{items.length} questões</span>
            <Button onClick={save} disabled={busy || !items.length}>
              {busy ? <Spinner /> : <Save className="size-4" />} Salvar lista
            </Button>
          </div>
        </div>
      </div>
    </PickerApiProvider>
  );
}
