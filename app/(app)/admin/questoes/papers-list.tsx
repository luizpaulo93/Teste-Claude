'use client';

import { AlertTriangle, Check, ImageOff, Search, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { confirmDialog } from '@/components/confirm';
import { toast } from '@/components/toast';
import { Badge, Button, Card, Input } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import { cn } from '@/lib/utils';
import { deleteManyPapers } from './actions';
import { DeletePaper } from './importer';

export interface PaperView {
  id: string;
  label: string;
  caderno: string;
  total: number;
  answers: number;
  images: number;
  missing: number;
  /** questões sem resolução */
  noRes: number;
  /** fórmulas com erro / texto corrompido achados na importação */
  problems: { n: number; onde: string; msg: string }[];
}

/** Provas do app: marcar várias (ou todas as da busca) e excluir de uma vez. */
export function PapersList({ papers }: { papers: PaperView[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const term = q.trim().toLowerCase();
  const shown = useMemo(
    () => (term ? papers.filter((p) => `${p.label} ${p.caderno} ${p.id}`.toLowerCase().includes(term)) : papers),
    [papers, term],
  );
  const allShown = shown.length > 0 && shown.every((p) => sel.has(p.id));
  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSel((s) => {
      const n = new Set(s);
      for (const p of shown) {
        if (allShown) n.delete(p.id);
        else n.add(p.id);
      }
      return n;
    });

  async function removeSelected() {
    const ids = [...sel];
    if (!ids.length) return;
    const qs = papers.filter((p) => sel.has(p.id)).reduce((a, p) => a + p.total, 0);
    const ok = await confirmDialog(
      `Excluir ${ids.length} ${ids.length === 1 ? 'prova' : 'provas'} (${qs} questões)? Elas saem das listas e as respostas dos alunos nelas somem.`,
      'Excluir',
    );
    if (!ok) return;
    setBusy(true);
    const r = await deleteManyPapers(ids).catch(() => null);
    setBusy(false);
    if (!r) return toast.error('Não foi possível excluir agora.');
    toast(`${r.n} ${r.n === 1 ? 'prova excluída' : 'provas excluídas'}`);
    setSel(new Set());
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {papers.length > 6 && (
          <div className="relative min-w-0 flex-1 basis-56">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar prova" aria-label="Buscar prova" className="h-10 pl-9" />
          </div>
        )}
        <Button variant="secondary" size="sm" onClick={toggleAll} disabled={!shown.length}>
          {allShown ? <X className="size-4" /> : <Check className="size-4" />} {allShown ? 'Desmarcar' : 'Selecionar todas'}
          {term && !allShown ? ` (${shown.length})` : ''}
        </Button>
      </div>

      {shown.map((p) => {
        const on = sel.has(p.id);
        return (
          <Card key={p.id} className={cn('flex flex-wrap items-center gap-2 p-3.5 transition', on && 'border-brand/60 bg-brand/5')}>
            <div className="flex w-full min-w-0 items-start gap-3">
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-label={`Selecionar ${p.label}`}
                onClick={() => toggle(p.id)}
                className={cn(
                  'mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2 transition',
                  on ? 'border-brand bg-brand text-white' : 'border-line-strong',
                )}
              >
                {on && <Check className="size-3.5" />}
              </button>
              <div className="min-w-0 flex-1">
                <Link href={`/questoes?prova=${encodeURIComponent(p.id)}`} className="block text-sm font-bold break-words text-ink hover:text-brand">
                  {p.label}
                </Link>
                <p className="mt-0.5 text-[11px] break-words text-muted">
                  {p.caderno ? `Caderno ${p.caderno} · ` : ''}
                  {p.id}
                </p>
              </div>
            </div>
            <Badge>{p.total} questões</Badge>
            {p.answers > 0 && <Badge tone="brand">{p.answers} respostas</Badge>}
            {p.missing > 0 ? (
              <Badge tone="warning">
                <ImageOff className="size-3" /> faltam {p.missing} imagens
              </Badge>
            ) : (
              p.images > 0 && <Badge tone="success">{p.images} imagens</Badge>
            )}
            {p.noRes > 0 && <Badge tone="warning">{p.noRes === p.total ? 'sem resolução' : `${p.noRes} sem resolução`}</Badge>}
            {p.problems.length > 0 && (
              <button type="button" onClick={() => setOpen((o) => (o === p.id ? null : p.id))} aria-expanded={open === p.id}>
                <Badge tone="danger">
                  <AlertTriangle className="size-3" /> {new Set(p.problems.map((x) => x.n)).size} com fórmula a revisar
                </Badge>
              </button>
            )}
            <span className="ml-auto">
              <DeletePaper id={p.id} />
            </span>
            {open === p.id && (
              <ul className="w-full space-y-1 rounded-xl bg-surface-2 p-2.5 text-[11px] text-ink-2">
                {p.problems.map((x, k) => (
                  <li key={k}>
                    <b className="text-ink">Questão {x.n}</b> ({x.onde}): {x.msg}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
      {!shown.length && <p className="rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">Nenhuma prova encontrada.</p>}

      {/* barra de exclusão: aparece quando há provas marcadas */}
      {sel.size > 0 && (
        <div className="sticky bottom-20 z-20 flex items-center gap-2 rounded-2xl border border-line-strong bg-surface/95 p-2.5 pl-4 shadow-2xl backdrop-blur lg:bottom-4">
          <span className="min-w-0 flex-1 text-sm font-semibold text-ink">
            {sel.size} {sel.size === 1 ? 'prova selecionada' : 'provas selecionadas'}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setSel(new Set())}>
            Cancelar
          </Button>
          <Button size="sm" onClick={removeSelected} disabled={busy} className="!bg-red-600 hover:!bg-red-700">
            {busy ? <Spinner /> : <Trash2 className="size-4" />} Excluir
          </Button>
        </div>
      )}
    </div>
  );
}
