'use client';

import { ArrowDown, ArrowUp, Check, Pencil, Plus, Tag, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from '@/components/toast';
import { Button, buttonClass, Card, Input } from '@/components/ui';
import { ActionButton } from '@/components/ui-client';
import type { CourseTag } from '@/lib/types';
import { cn } from '@/lib/utils';
import { deleteTag, moveTag, saveTag } from '../content-actions';

/** Tags de disciplina: o admin cria, renomeia e ordena; elas viram o filtro da página Cursos do aluno. */
export function TagsManager({ tags, counts }: { tags: CourseTag[]; counts: Record<string, number> }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [edit, setEdit] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(p: Promise<{ error?: string }>, ok?: string) {
    setBusy(true);
    const r = await p.catch(() => ({ error: 'Não foi possível salvar.' }));
    setBusy(false);
    if (r.error) return toast.error(r.error);
    if (ok) toast(ok);
    router.refresh();
    return true;
  }
  return (
    <Card className="mb-6 space-y-3 p-4">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <Tag className="size-4 text-brand" /> Tags de disciplina
        </p>
        <p className="text-xs text-muted">Viram o filtro da página Cursos, nesta ordem. Escolha as tags de cada curso ao editá-lo.</p>
      </div>
      {tags.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {tags.map((t, i) => (
            <li key={t.id} className="flex items-center gap-2 px-3 py-2">
              {edit?.id === t.id ? (
                <form
                  className="flex flex-1 items-center gap-1.5"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await run(saveTag(t.id, edit.name), 'Tag renomeada')) setEdit(null);
                  }}
                >
                  <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} maxLength={40} className="h-8" autoFocus aria-label="Nome da tag" />
                  <button type="submit" disabled={busy} aria-label="Salvar" className={buttonClass('ghost', 'icon', 'size-8 text-success')}>
                    <Check className="size-4" />
                  </button>
                  <button type="button" onClick={() => setEdit(null)} aria-label="Cancelar" className={buttonClass('ghost', 'icon', 'size-8')}>
                    <X className="size-4" />
                  </button>
                </form>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                    {t.name} <span className="text-xs font-normal text-muted">· {counts[t.id] ?? 0} curso{(counts[t.id] ?? 0) === 1 ? '' : 's'}</span>
                  </span>
                  <button type="button" disabled={busy || i === 0} onClick={() => run(moveTag(t.id, -1))} aria-label="Subir" className={buttonClass('ghost', 'icon', 'size-8')}>
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button type="button" disabled={busy || i === tags.length - 1} onClick={() => run(moveTag(t.id, 1))} aria-label="Descer" className={buttonClass('ghost', 'icon', 'size-8')}>
                    <ArrowDown className="size-3.5" />
                  </button>
                  <button type="button" onClick={() => setEdit({ id: t.id, name: t.name })} aria-label="Renomear" className={buttonClass('ghost', 'icon', 'size-8')}>
                    <Pencil className="size-3.5" />
                  </button>
                  <ActionButton action={() => deleteTag(t.id)} confirm={`Excluir a tag "${t.name}"? Os cursos continuam, só saem do filtro.`} success="Tag excluída" variant="ghost" size="sm" className="size-8 px-0 hover:text-danger" title="Excluir tag">
                    <Trash2 className="size-3.5" />
                  </ActionButton>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(saveTag(null, name), 'Tag criada')) setName('');
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Nova tag (ex.: Matemática)" aria-label="Nova tag" />
        <Button type="submit" disabled={busy || !name.trim()} className="shrink-0">
          <Plus className="size-4" /> Criar
        </Button>
      </form>
    </Card>
  );
}

/** No formulário do curso: escolhe as tags (só as que o admin criou). */
export function TagPicker({ tags, selected }: { tags: CourseTag[]; selected: string[] }) {
  const [sel, setSel] = useState(selected);
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-semibold text-ink-2">Tags (filtro do catálogo)</span>
      {sel.map((id) => (
        <input key={id} type="hidden" name="tag_ids" value={id} />
      ))}
      {tags.length ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => {
            const on = sel.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() => setSel((l) => (on ? l.filter((x) => x !== t.id) : [...l, t.id]))}
                className={cn('rounded-full border px-3 py-1 text-xs font-semibold transition', on ? 'border-brand bg-brand text-white' : 'border-line-strong text-ink-2 hover:bg-surface-2')}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted">Crie as tags em Admin → Cursos (Tags de disciplina).</p>
      )}
    </div>
  );
}
