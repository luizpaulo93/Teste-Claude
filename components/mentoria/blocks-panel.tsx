'use client';

import { CalendarRange, FileText, Flame, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { PdfDrop } from '@/components/admin/uploads';
import { toast } from '@/components/toast';
import { Button, buttonClass, Field, Input } from '@/components/ui';
import { ActionButton, Modal, Spinner } from '@/components/ui-client';
import { deleteBlock, saveBlock } from '@/app/(app)/admin/mentoria/block-actions';
import { ASSUNTO_BY_KEY, ASSUNTOS, DISCIPLINES } from '@/lib/enem-matriz';
import { cn } from '@/lib/utils';
import { periodLabel, type ApostilaGroup } from './apostilas';

export interface BlockData extends ApostilaGroup {
  item_keys: string[];
}

const shiftISO = (date: string, days: number) => {
  const t = new Date(`${date}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
};
const plusMonth = (date: string) => {
  const t = new Date(`${date}T12:00:00Z`);
  t.setUTCMonth(t.getUTCMonth() + 1);
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
};
const KINDS = [
  { key: 'dia', label: 'Um dia' },
  { key: 'semana', label: 'Uma semana' },
  { key: 'mes', label: 'Um mês' },
  { key: 'livre', label: 'Escolher datas' },
] as const;
type Kind = (typeof KINDS)[number]['key'];
const endFor = (kind: Kind, start: string, cur: string) =>
  kind === 'dia' ? start : kind === 'semana' ? shiftISO(start, 6) : kind === 'mes' ? plusMonth(start) : cur < start ? start : cur;

/**
 * Cronograma flexível: o mentor liga assuntos e apostilas a um dia ou a um período (vários dias,
 * uma semana, um mês). Serve tanto para o aluno particular (um assunto na semana) quanto para quem
 * estuda vários assuntos por dia. Funciona na mentoria individual e em grupo.
 */
export function BlocksPanel({ space, blocks, today }: { space: string; blocks: BlockData[]; today: string }) {
  const [edit, setEdit] = useState<BlockData | 'new' | null>(null);
  const sorted = [...blocks].sort((a, b) => a.start_on.localeCompare(b.start_on));
  const current = sorted.filter((b) => b.end_on >= today);
  const past = sorted.filter((b) => b.end_on < today).reverse();
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-ink">Assuntos por dia ou período</p>
          <p className="text-xs text-muted">Ligue assuntos e apostilas a um dia, uma semana, um mês ou às datas que quiser.</p>
        </div>
        <Button size="sm" onClick={() => setEdit('new')} className="shrink-0">
          <Plus className="size-4" /> Novo período
        </Button>
      </div>
      {current.length + past.length > 0 && (
        <ul className="space-y-2">
          {[...current, ...past].map((b) => {
            const now = b.start_on <= today && b.end_on >= today;
            return (
              <li key={b.id} className={cn('flex items-start gap-3 rounded-xl border p-3', b.end_on < today ? 'border-line opacity-60' : now ? 'border-brand/50 bg-brand/5' : 'border-line')}>
                <CalendarRange className={cn('mt-0.5 size-4 shrink-0', now ? 'text-brand' : 'text-muted')} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-ink">
                    {periodLabel(b.start_on, b.end_on)}
                    {b.title && <span className="font-normal text-ink-2"> · {b.title}</span>}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {b.item_keys.map((k) => ASSUNTO_BY_KEY.get(k)?.title ?? k).join(' · ') || 'Sem assuntos'}
                  </p>
                  {b.files.length > 0 && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-500">
                      <FileText className="size-3" /> {b.files.length} apostila{b.files.length > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <button type="button" onClick={() => setEdit(b)} aria-label="Editar período" className={buttonClass('ghost', 'icon', 'size-8 shrink-0')}>
                  <Pencil className="size-3.5" />
                </button>
                <ActionButton
                  action={() => deleteBlock(b.id)}
                  confirm="Excluir este período? Os assuntos que entraram só por ele e não foram estudados saem do cronograma."
                  success="Período excluído"
                  variant="ghost"
                  size="sm"
                  className="size-8 shrink-0 px-0 hover:text-danger"
                  title="Excluir período"
                >
                  <Trash2 className="size-3.5" />
                </ActionButton>
              </li>
            );
          })}
        </ul>
      )}
      {edit && <BlockModal space={space} today={today} block={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function BlockModal({ space, today, block, onClose }: { space: string; today: string; block: BlockData | null; onClose: () => void }) {
  const router = useRouter();
  const initialKind: Kind = !block ? 'semana' : block.start_on === block.end_on ? 'dia' : block.end_on === shiftISO(block.start_on, 6) ? 'semana' : block.end_on === plusMonth(block.start_on) ? 'mes' : 'livre';
  const [kind, setKind] = useState<Kind>(initialKind);
  const [start, setStart] = useState(block?.start_on ?? today);
  const [end, setEnd] = useState(block?.end_on ?? shiftISO(today, 6));
  const [title, setTitle] = useState(block?.title ?? '');
  const [keys, setKeys] = useState<string[]>(block?.item_keys ?? []);
  const [files, setFiles] = useState(block?.files ?? []);
  const [uploading, setUploading] = useState(false);
  const [disc, setDisc] = useState(DISCIPLINES[0].key);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const term = q.trim().toLowerCase();
  const found = useMemo(
    () => ASSUNTOS.filter((a) => (term ? a.title.toLowerCase().includes(term) : a.discipline === disc)).slice(0, term ? 40 : 200),
    [term, disc],
  );

  const pickKind = (k: Kind) => {
    setKind(k);
    setEnd((cur) => endFor(k, start, cur));
  };
  const pickStart = (v: string) => {
    if (!v) return;
    setStart(v);
    setEnd((cur) => endFor(kind, v, cur));
  };
  const toggle = (k: string) => setKeys((l) => (l.includes(k) ? l.filter((x) => x !== k) : [...l, k]));

  async function save() {
    setBusy(true);
    const r = await saveBlock({ id: block?.id, space, title, item_keys: keys, start_on: start, end_on: end, files }).catch(() => ({ error: 'Não foi possível salvar.' }));
    setBusy(false);
    if (r.error) return toast.error(r.error);
    toast('Período salvo no cronograma.');
    onClose();
    router.refresh();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={block ? 'Editar período' : 'Novo período'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={busy || uploading}>
            {busy ? <Spinner /> : null} Salvar período
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-ink-2">Duração</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {KINDS.map((k) => (
              <button
                key={k.key}
                type="button"
                aria-pressed={kind === k.key}
                onClick={() => pickKind(k.key)}
                className={cn('rounded-xl border px-2 py-2 text-xs font-semibold transition', kind === k.key ? 'border-brand bg-brand text-white' : 'border-line text-ink-2 hover:bg-surface-2')}
              >
                {k.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Início">
              <Input type="date" value={start} onChange={(e) => pickStart(e.target.value)} aria-label="Início do período" />
            </Field>
            <Field label="Fim">
              <Input type="date" value={end} min={start} disabled={kind !== 'livre'} onChange={(e) => setEnd(e.target.value)} aria-label="Fim do período" />
            </Field>
          </div>
        </div>

        <Field label="Nome (opcional)">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="Ex.: Semana de Cinemática" />
        </Field>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-ink-2">
            Assuntos do período <span className="font-normal text-muted">({keys.length} escolhido{keys.length === 1 ? '' : 's'})</span>
          </p>
          {keys.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {keys.map((k) => (
                <button key={k} type="button" onClick={() => toggle(k)} className="flex items-center gap-1 rounded-lg bg-brand/12 px-2 py-1 text-[11px] font-semibold text-brand">
                  {ASSUNTO_BY_KEY.get(k)?.title ?? k} <X className="size-3" />
                </button>
              ))}
            </div>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar assunto" className="pl-9" aria-label="Buscar assunto" />
          </div>
          {!term && (
            <div className="rail flex gap-1.5 overflow-x-auto">
              {DISCIPLINES.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setDisc(d.key)}
                  className={cn('shrink-0 rounded-lg border px-2.5 py-1 text-xs font-semibold', disc === d.key ? 'border-brand bg-brand text-white' : 'border-line text-ink-2')}
                >
                  {d.name}
                </button>
              ))}
            </div>
          )}
          <ul className="max-h-60 divide-y divide-line overflow-y-auto rounded-xl border border-line">
            {found.map((a) => {
              const on = keys.includes(a.key);
              return (
                <li key={a.key}>
                  <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] text-ink">
                    <input type="checkbox" checked={on} onChange={() => toggle(a.key)} className="size-4 accent-[var(--color-brand)]" />
                    <span className="min-w-0 flex-1">
                      {a.title}
                      {a.priority >= 3 && <Flame className="ml-1 inline size-3 text-orange-500" />}
                    </span>
                  </label>
                </li>
              );
            })}
            {!found.length && <li className="px-3 py-4 text-center text-xs text-muted">Nenhum assunto encontrado.</li>}
          </ul>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-ink-2">Apostilas (PDF)</p>
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2">
              <FileText className="size-4 shrink-0 text-danger" />
              <Input
                value={f.title}
                onChange={(e) => setFiles((l) => l.map((x) => (x.id === f.id ? { ...x, title: e.target.value } : x)))}
                className="h-8 flex-1 border-0 bg-transparent px-1"
                aria-label="Nome da apostila"
              />
              <span className="shrink-0 text-[10px] text-muted">{f.size_label}</span>
              <button type="button" onClick={() => setFiles((l) => l.filter((x) => x.id !== f.id))} aria-label="Tirar apostila" className="text-muted hover:text-danger">
                <X className="size-4" />
              </button>
            </div>
          ))}
          <PdfDrop
            folder="mentoria/apostilas"
            multiple
            label="Subir apostilas"
            onBatchStart={() => setUploading(true)}
            onBatchDone={() => setUploading(false)}
            onUploaded={(r) => setFiles((l) => [...l, { id: crypto.randomUUID().slice(0, 12), title: r.title, file_path: r.path, size_label: r.size }])}
          />
        </div>
      </div>
    </Modal>
  );
}
