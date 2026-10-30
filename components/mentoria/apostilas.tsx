'use client';

import { FileText, Folder, FolderOpen } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/components/toast';
import { Spinner } from '@/components/ui-client';
import { usePdfOwner } from '@/components/pdf-owner';
import { stampedPdfUrl } from '@/lib/pdf-stamp';
import { getFileUrl } from '@/lib/storage/client';
import { cn } from '@/lib/utils';

export interface ApostilaGroup {
  id: string;
  title: string;
  start_on: string;
  end_on: string;
  files: { id: string; title: string; file_path: string; size_label: string }[];
}

const dm = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;
export const periodLabel = (from: string, to: string) => (from === to ? dm(from) : `${dm(from)} a ${dm(to)}`);

/** Abre um PDF privado (link temporário do R2). */
export function FileRow({ f }: { f: ApostilaGroup['files'][number] }) {
  const [busy, setBusy] = useState(false);
  const owner = usePdfOwner();
  async function open() {
    setBusy(true);
    // Abre a aba antes (no celular o popup só abre no toque)
    const w = window.open('', '_blank');
    try {
      // Cada página sai com nome, e-mail, CPF e telefone de quem abriu
      const url = await stampedPdfUrl(await getFileUrl(f.file_path, f.title), owner);
      if (w) w.location.href = url;
      else window.location.href = url;
    } catch (e) {
      w?.close();
      toast.error(e instanceof Error ? e.message : 'Arquivo indisponível.');
    }
    setBusy(false);
  }
  return (
    <button type="button" onClick={open} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-surface-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-danger/10 text-danger">{busy ? <Spinner /> : <FileText className="size-4" />}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-ink">{f.title}</span>
        {f.size_label && <span className="block text-[10px] text-muted">PDF · {f.size_label}</span>}
      </span>
    </button>
  );
}

/** Pastinha do dia/período no cronograma: apostilas que o mentor subiu para esse período. */
export function DayFolder({ groups }: { groups: ApostilaGroup[] }) {
  const withFiles = groups.filter((g) => g.files.length);
  const [open, setOpen] = useState(true);
  if (!withFiles.length) return null;
  const n = withFiles.reduce((a, g) => a + g.files.length, 0);
  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2.5 p-3.5 text-left">
        {open ? <FolderOpen className="size-5 text-amber-500" /> : <Folder className="size-5 text-amber-500" />}
        <span className="flex-1 text-sm font-bold text-ink">Apostilas deste período</span>
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-500">{n}</span>
      </button>
      {open && (
        <div className="space-y-2 px-2 pb-2">
          {withFiles.map((g) => (
            <div key={g.id}>
              <p className="px-2 text-[11px] font-semibold text-muted">
                {g.title || 'Período'} · {periodLabel(g.start_on, g.end_on)}
              </p>
              {g.files.map((f) => (
                <FileRow key={f.id} f={f} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Pasta com todos os documentos da mentoria (aluno e mentor veem a mesma). */
export function ApostilasFolder({ groups, today }: { groups: ApostilaGroup[]; today: string }) {
  const list = groups.filter((g) => g.files.length);
  if (!list.length)
    return <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-sm text-muted">Nenhuma apostila ainda. Quando o mentor subir, elas aparecem aqui e no dia do cronograma.</p>;
  return (
    <div className="space-y-3">
      {list.map((g) => {
        const now = g.start_on <= today && g.end_on >= today;
        return (
          <section key={g.id} className={cn('rounded-2xl border bg-surface p-2', now ? 'border-amber-500/50' : 'border-line')}>
            <div className="flex items-center gap-2 px-2 pt-1.5 pb-1">
              <Folder className="size-4 text-amber-500" />
              <p className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{g.title || 'Apostilas'}</p>
              <span className={cn('shrink-0 text-[11px] font-semibold', now ? 'text-amber-500' : 'text-muted')}>
                {now ? 'agora · ' : ''}
                {periodLabel(g.start_on, g.end_on)}
              </span>
            </div>
            {g.files.map((f) => (
              <FileRow key={f.id} f={f} />
            ))}
          </section>
        );
      })}
    </div>
  );
}
