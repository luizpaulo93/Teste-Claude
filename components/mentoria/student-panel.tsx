'use client';

import { ArrowRight, Download, Flame, History, ListChecks, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PDFDocument } from 'pdf-lib';
import { useMemo, useState } from 'react';
import { createReviewList } from '@/app/(app)/mentoria/actions';
import { usePdfOwner } from '@/components/pdf-owner';
import { ListDownloads } from '@/components/questoes/my-lists';
import { toast } from '@/components/toast';
import { Button, buttonClass, Field, Input, Select } from '@/components/ui';
import { Modal, Spinner } from '@/components/ui-client';
import { fetchFile, safeName, saveBlob } from '@/lib/download';
import { stampedPdfUrl } from '@/lib/pdf-stamp';
import { cn, formatDate } from '@/lib/utils';

export const PHASES = [
  { key: -1, label: 'Fora da trilha', dot: 'bg-surface-3', chip: 'border-line text-muted' },
  { key: 0, label: 'Teoria', dot: 'bg-zinc-400', chip: 'border-zinc-400/40 text-ink-2' },
  { key: 1, label: 'Nível 1', dot: 'bg-sky-400', chip: 'border-sky-400/40 text-sky-500' },
  { key: 2, label: 'Nível 2', dot: 'bg-amber-400', chip: 'border-amber-400/40 text-amber-500' },
  { key: 3, label: 'Nível 3', dot: 'bg-orange-500', chip: 'border-orange-500/40 text-orange-500' },
  { key: 4, label: 'Dominado', dot: 'bg-emerald-500', chip: 'border-emerald-500/40 text-emerald-500' },
];
const phaseOf = (p: number) => PHASES[p + 1];

/** Botão "Criar lista de revisão": com o que o aluno já estudou (questões que errou e questões novas). */
export function ReviewButton({ disciplines, mentoriaId, className }: { disciplines: { key: string; name: string }[]; mentoriaId?: string; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState(10);
  const [disc, setDisc] = useState('');
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    const r = await createReviewList(size, disc || undefined, mentoriaId).catch(() => ({ error: 'Sem conexão.' }) as { error: string; listId?: string });
    setBusy(false);
    if (r.error) return toast.error(r.error);
    setOpen(false);
    toast(`Lista de revisão criada com ${'count' in r ? r.count : size} questões.`);
    if (r.listId) router.push(`/listas/${r.listId}`);
  }
  return (
    <>
      <Button onClick={() => setOpen(true)} className={className}>
        <History className="size-4" /> Criar lista de revisão
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Lista de revisão" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-ink-2">
            Com os assuntos que você já estudou: primeiro as questões que você errou e já estão na hora de voltar, depois questões novas de
            cada assunto.
          </p>
          <Field label="Disciplina">
            <Select value={disc} onChange={(e) => setDisc(e.target.value)}>
              <option value="">Todas</option>
              {disciplines.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-2">Questões</p>
            <div className="grid grid-cols-4 gap-1.5">
              {[5, 10, 15, 20].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSize(n)}
                  aria-pressed={size === n}
                  className={cn('num h-10 rounded-lg border text-sm font-medium', size === n ? 'border-ink bg-ink text-bg' : 'border-line text-ink-2 hover:bg-surface-2')}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={go} disabled={busy} className="w-full">
            {busy ? <Spinner /> : <ListChecks className="size-4" />} Criar e abrir
          </Button>
        </div>
      </Modal>
    </>
  );
}

export interface PanelSubject {
  key: string;
  discipline: string;
  block: string;
  title: string;
  priority: number;
  phase: number;
  hard: boolean;
  scheduled: string | null;
}

/** Todos os assuntos do ENEM da(s) disciplina(s) e a fase do aluno em cada um. */
export function AllSubjects({ subjects, disciplines }: { subjects: PanelSubject[]; disciplines: { key: string; name: string }[] }) {
  const [disc, setDisc] = useState(disciplines[0]?.key ?? '');
  const [phase, setPhase] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const mine = subjects.filter((s) => s.discipline === disc);
  const term = q.trim().toLowerCase();
  const shown = mine.filter((s) => (phase === null || s.phase === phase) && (!term || `${s.block} ${s.title}`.toLowerCase().includes(term)));
  const blocks = [...new Set(shown.map((s) => s.block))];
  const count = (p: number) => mine.filter((s) => s.phase === p).length;
  return (
    <div className="space-y-3">
      <div className="rail -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {disciplines.map((d) => {
          const all = subjects.filter((s) => s.discipline === d.key);
          const pct = all.length ? Math.round((all.filter((s) => s.phase === 4).length / all.length) * 100) : 0;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => setDisc(d.key)}
              aria-pressed={disc === d.key}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition',
                disc === d.key ? 'border-ink bg-ink text-bg' : 'border-line text-ink-2 hover:bg-surface-2',
              )}
            >
              {d.name}
              <span className={cn('num text-[11px]', disc === d.key ? 'text-bg/70' : 'text-muted')}>{pct}%</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setPhase(null)}
          aria-pressed={phase === null}
          className={cn('rounded-md border px-2 py-1 text-[11px] font-medium', phase === null ? 'border-ink bg-ink text-bg' : 'border-line text-ink-2')}
        >
          Todos <span className="num opacity-70">{mine.length}</span>
        </button>
        {PHASES.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPhase(phase === p.key ? null : p.key)}
            aria-pressed={phase === p.key}
            className={cn(
              'flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium',
              phase === p.key ? 'border-ink bg-ink text-bg' : 'border-line text-ink-2 hover:bg-surface-2',
            )}
          >
            <span className={cn('size-1.5 rounded-full', p.dot)} />
            {p.label} <span className="num opacity-70">{count(p.key)}</span>
          </button>
        ))}
        <label className="relative ml-auto w-full sm:w-48">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar assunto" className="h-8 pl-8 text-xs" />
        </label>
      </div>
      <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
        {blocks.map((b) => (
          <div key={b}>
            <p className="mb-1 font-mono text-[10.5px] tracking-[0.08em] text-muted uppercase">{b}</p>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {shown
                .filter((s) => s.block === b)
                .map((s) => {
                  const p = phaseOf(s.phase);
                  return (
                    <li key={s.key} className="flex items-center gap-2.5 px-3 py-2">
                      <span className={cn('size-2 shrink-0 rounded-full', p.dot)} />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{s.title}</span>
                      {s.priority >= 3 && <Flame className="size-3 shrink-0 text-orange-500" aria-label="mais cobrado" />}
                      {s.hard && <span className="rounded bg-danger/10 px-1 py-px text-[10px] text-danger">reforço</span>}
                      <span className={cn('shrink-0 rounded border px-1.5 py-px text-[10.5px] font-medium', p.chip)}>
                        {s.phase === 0 && s.scheduled ? `Teoria · ${formatDate(s.scheduled)}` : p.label}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
        {!shown.length && <p className="text-sm text-muted">Nenhum assunto com esse filtro.</p>}
      </div>
    </div>
  );
}

export interface PanelList {
  id: string;
  title: string;
  level: number;
  status: string;
  ok: number | null;
  total: number | null;
  created_at: string;
  n: number;
  answered: number;
  finished: boolean;
}

/** Todas as listas da mentoria: abrir, baixar cada uma (com a marca do aluno) ou todas juntas num PDF só. */
export function MentoriaLists({ lists }: { lists: PanelList[] }) {
  const owner = usePdfOwner();
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState(false);
  const shown = useMemo(() => (all ? lists : lists.slice(0, 8)), [lists, all]);
  async function downloadAll() {
    setBusy(true);
    toast(`Gerando o PDF com ${lists.length} listas…`);
    try {
      const out = await PDFDocument.create();
      // da mais antiga para a mais nova, como um caderno
      let skipped = 0;
      for (const l of [...lists].reverse()) {
        // finalizada: com as resoluções; se não der, só as questões; se nem isso, pula a lista
        const blob = await fetchFile(`/api/listas/${l.id}/arquivo?formato=pdf&parte=${l.finished ? 'tudo' : 'questoes'}`, 'pdf')
          .catch(() => (l.finished ? fetchFile(`/api/listas/${l.id}/arquivo?formato=pdf&parte=questoes`, 'pdf') : Promise.reject(new Error('x'))))
          .catch(() => null);
        if (!blob) {
          skipped++;
          continue;
        }
        const doc = await PDFDocument.load(await blob.arrayBuffer());
        for (const p of await out.copyPages(doc, doc.getPageIndices())) out.addPage(p);
      }
      if (!out.getPageCount()) throw new Error('Não foi possível gerar as listas agora.');
      if (skipped) toast(`${skipped} lista(s) não entraram no PDF.`);
      const bytes = await out.save();
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      // cada página sai com nome, e-mail e CPF de quem baixou (como nas outras listas)
      saveBlob(await stampedPdfUrl(url, owner), safeName('Listas da mentoria', 'pdf'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível gerar o PDF agora.');
    }
    setBusy(false);
  }
  if (!lists.length) return <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">As listas da trilha aparecem aqui.</p>;
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={downloadAll} disabled={busy}>
          {busy ? <Spinner /> : <Download className="size-4" />} Baixar todas em um PDF
        </Button>
      </div>
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
        {shown.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{l.title}</p>
              <p className="num text-[11px] text-muted">
                {formatDate(l.created_at.slice(0, 10))} ·{' '}
                {l.status === 'closed'
                  ? 'fechada pelo mentor'
                  : !l.finished
                    ? `${l.answered}/${l.n} respondidas`
                    : l.total
                      ? `${l.ok}/${l.total} ${l.status === 'passed' ? '· passou' : l.status === 'failed' ? '· nova lista criada' : ''}`
                      : 'revisão feita'}
              </p>
            </div>
            <Link href={`/listas/${l.id}`} className={buttonClass(l.finished || l.status === 'closed' ? 'ghost' : 'primary', 'sm')}>
              {l.finished || l.status === 'closed' ? 'Ver' : 'Fazer'} <ArrowRight className="size-3.5" />
            </Link>
            <ListDownloads id={l.id} title={l.title} compact resolutions={l.finished} />
          </li>
        ))}
      </ul>
      {lists.length > 8 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="w-full rounded-md py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-ink">
          {all ? 'Mostrar só as recentes' : `Mostrar todas (${lists.length})`}
        </button>
      )}
    </div>
  );
}
