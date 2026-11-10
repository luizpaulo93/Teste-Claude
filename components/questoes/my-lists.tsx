'use client';

import { BookOpenCheck, ChevronRight, Download, FileText, ListChecks, Shuffle, Trash2 } from 'lucide-react';
import { taxOrder } from '@/lib/taxonomy';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { countRandom, createRandomList, deleteMyList, randomOptions } from '@/app/(app)/questoes/aluno-actions';
import { usePdfOwner } from '@/components/pdf-owner';
import { toast } from '@/components/toast';
import { Button, Card, Field, Input, Select } from '@/components/ui';
import { ActionButton, Modal, Spinner } from '@/components/ui-client';
import { fetchFile, safeName, saveBlob } from '@/lib/download';
import { stampedPdfUrl } from '@/lib/pdf-stamp';
import { vestLabel } from '@/lib/question-types';
import { cn } from '@/lib/utils';
import { MultiField } from './filters';

const DIF = [
  { key: 'facil', label: 'Fácil' },
  { key: 'media', label: 'Média' },
  { key: 'dificil', label: 'Difícil' },
];

/** Os dois jeitos de o aluno montar uma lista: aleatória (sorteio com filtros) ou escolhendo as questões. */
export function ListTypeCards() {
  const [random, setRandom] = useState(false);
  const card = 'flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition hover:border-brand/40';
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => setRandom(true)} className={card}>
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand">
            <Shuffle className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-ink">Criar lista aleatória</span>
            <span className="block text-xs text-muted">Escolha os filtros e o app sorteia</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted" />
        </button>
        <Link href="/questoes/montar" className={card}>
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-success/12 text-success">
            <ListChecks className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-ink">Escolher questões</span>
            <span className="block text-xs text-muted">Uma a uma, com filtros</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted" />
        </Link>
      </div>
      {random && <RandomModal onClose={() => setRandom(false)} />}
    </>
  );
}

type Row = Awaited<ReturnType<typeof randomOptions>>[number];

/** Popup da lista aleatória: nome, filtros (vários valores) e quantas questões. */
function RandomModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [title, setTitle] = useState('');
  const [f, setF] = useState<{ vestibular: string[]; area: string[]; disciplina: string[]; assunto: string[]; habilidade: string[]; dificuldade: string[] }>({
    vestibular: [],
    area: [],
    disciplina: [],
    assunto: [],
    habilidade: [],
    dificuldade: [],
  });
  const [count, setCount] = useState('20');
  const [busy, setBusy] = useState(false);
  const [avail, setAvail] = useState<number | null>(null);
  // quantas questões existem com os filtros: as opções param no máximo possível (até 45)
  useEffect(() => {
    let alive = true;
    countRandom(f)
      .then((n) => alive && setAvail(n))
      .catch(() => alive && setAvail(null));
    return () => {
      alive = false;
    };
  }, [f]);
  const counts = useMemo(() => {
    const max = Math.min(45, avail ?? 45);
    const base = [5, 10, 15, 20, 30, 45].filter((n) => n < max);
    return max > 0 ? [...base, max] : [];
  }, [avail]);
  // quantidade valendo: a escolhida, se ainda couber nos filtros; senão 20 (ou o máximo possível)
  const qty = counts.includes(Number(count)) ? count : String(counts.includes(20) ? 20 : (counts[counts.length - 1] ?? 20));
  useEffect(() => {
    randomOptions()
      .then(setRows)
      .catch(() => setRows([]));
  }, []);
  const opts = useMemo(() => {
    const has = (l: string[], v: string) => !l.length || l.includes(v);
    const all = rows ?? [];
    // nenhum vestibular marcado: todos (a lista vem misturada)
    const r = all.filter((x) => has(f.vestibular, x.vestibular));
    const uniq = (list: Row[], get: (x: Row) => string) =>
      [...new Set(list.map(get).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
    return {
      vestibular: uniq(all, (x) => x.vestibular),
      area: uniq(r, (x) => x.area),
      disciplina: uniq(
        r.filter((x) => has(f.area, x.area)),
        (x) => x.disciplina,
      ),
      // lista aleatória: só os assuntos gerais (na ordem da taxonomia), sem subassuntos
      assunto: taxOrder(
        uniq(
          r.filter((x) => has(f.area, x.area) && has(f.disciplina, x.disciplina)),
          (x) => x.assunto_geral,
        ),
      ),
      habilidade: uniq(
        r.filter((x) => has(f.area, x.area) && has(f.disciplina, x.disciplina) && has(f.assunto, x.assunto_geral)),
        (x) => x.habilidade,
      ),
    };
  }, [rows, f]);

  async function generate() {
    if (!title.trim()) return toast.error('Dê um nome para a lista.');
    setBusy(true);
    const r = await createRandomList({ title, count: Number(qty), ...f }).catch(() => ({ error: 'Não foi possível gerar agora.' }));
    setBusy(false);
    if ('error' in r && r.error) return toast.error(r.error);
    const ok = r as { id: string; count: number };
    toast(`Lista gerada com ${ok.count} questões`);
    onClose();
    router.push(`/listas/${ok.id}`);
  }

  const set = (k: keyof typeof f) => (v: string[]) => setF((o) => ({ ...o, [k]: v }));
  return (
    <Modal
      open
      onClose={onClose}
      title="Lista aleatória"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={generate} disabled={busy || !rows || avail === 0}>
            {busy ? <Spinner /> : <Shuffle className="size-4" />} Gerar lista
          </Button>
        </>
      }
    >
      <div className="space-y-2.5">
        <Field label="Nome da lista">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Revisão de Mecânica" aria-label="Nome da lista" maxLength={120} />
        </Field>
        <p className="text-[11px] text-muted">Deixe em branco para valer todos. Dá para marcar mais de um em cada campo.</p>
        {!rows ? (
          <Spinner />
        ) : (
          <>
            <MultiField label="Vestibular" options={opts.vestibular} value={f.vestibular} onChange={set('vestibular')} show={vestLabel} />
            <MultiField label="Área do conhecimento" options={opts.area} value={f.area} onChange={set('area')} />
            <MultiField label="Disciplina" options={opts.disciplina} value={f.disciplina} onChange={set('disciplina')} />
            <MultiField label="Assunto" options={opts.assunto} value={f.assunto} onChange={set('assunto')} />
            <MultiField label="Habilidade" options={opts.habilidade} value={f.habilidade} onChange={set('habilidade')} />
            <MultiField
              label="Dificuldade"
              options={DIF.map((d) => d.key)}
              value={f.dificuldade}
              onChange={set('dificuldade')}
              show={(v) => DIF.find((d) => d.key === v)?.label ?? v}
            />
          </>
        )}
        <Field label="Quantidade de questões">
          <Select value={qty} onChange={(e) => setCount(e.target.value)} aria-label="Quantidade de questões" disabled={!counts.length}>
            {counts.map((n) => (
              <option key={n} value={n}>
                {n}
                {n === counts[counts.length - 1] && avail !== null && avail <= 45 ? ' (todas)' : ''}
              </option>
            ))}
          </Select>
        </Field>
        {avail === 0 && <p className="text-xs text-danger">Nenhuma questão com esses filtros.</p>}
      </div>
    </Modal>
  );
}

/** Baixa o PDF da lista (com a marca do aluno em cada página). */
async function downloadList(id: string, title: string, parte: 'questoes' | 'resolucoes' | 'tudo', owner: ReturnType<typeof usePdfOwner>) {
  const blob = await fetchFile(`/api/listas/${id}/arquivo?formato=pdf&parte=${parte}`, 'pdf');
  const suffix = parte === 'resolucoes' ? ' (resoluções)' : parte === 'tudo' ? ' (com resoluções)' : '';
  saveBlob(await stampedPdfUrl(URL.createObjectURL(blob), owner), safeName(`${title}${suffix}`, 'pdf'));
}

/** `resolutions`: false esconde as opções com resolução (teste ainda não finalizado ou não liberado). */
export function ListDownloads({ id, title, compact, resolutions = true }: { id: string; title: string; compact?: boolean; resolutions?: boolean }) {
  const owner = usePdfOwner();
  const [busy, setBusy] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);
  async function go(parte: 'questoes' | 'resolucoes' | 'tudo') {
    setOpen(false);
    setBusy(parte);
    toast('Gerando o PDF…');
    try {
      await downloadList(id, title, parte, owner);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível gerar o PDF agora.');
    }
    setBusy('');
  }
  const items = [
    { key: 'questoes', label: 'PDF da lista', icon: FileText },
    { key: 'resolucoes', label: 'Resoluções', icon: BookOpenCheck },
    { key: 'tudo', label: 'PDF com resoluções', icon: Download },
  ].filter((it) => resolutions || it.key === 'questoes') as { key: 'questoes' | 'resolucoes' | 'tudo'; label: string; icon: typeof Download }[];
  return (
    <div ref={ref} className="relative">
      <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)} disabled={Boolean(busy)} aria-expanded={open}>
        {busy ? <Spinner /> : <Download className="size-4" />} {compact ? '' : 'Baixar'}
      </Button>
      {open && (
        <div
          className={cn(
            'absolute z-30 mt-1 w-52 rounded-xl border border-line-strong bg-surface p-1 shadow-2xl',
            (ref.current?.getBoundingClientRect().left ?? 999) < 220 ? 'left-0' : 'right-0',
          )}
        >
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              onClick={() => void go(it.key)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-ink hover:bg-surface-2"
            >
              <it.icon className="size-4 text-brand" /> {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Cartão de uma lista do aluno: abre para responder; baixa a lista, as resoluções ou os dois. */
export function MyListCard({ list }: { list: { id: string; title: string; total: number; answered: number; right: number; finished?: boolean } }) {
  // o acerto só aparece depois de finalizar (antes, o aluno ainda está fazendo)
  const pct = list.finished ? Math.round((list.right / Math.max(1, list.total)) * 100) : null;
  return (
    <Card className="flex flex-wrap items-center gap-3 p-3.5">
      <Link href={`/listas/${list.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand">
          <ListChecks className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold break-words text-ink">{list.title}</span>
          <span className="block text-xs text-muted">
            {list.finished ? 'Finalizada' : `${list.answered} de ${list.total} respondidas`}
            {pct !== null && (
              <span className={cn('font-semibold', pct >= 70 ? 'text-success' : pct >= 50 ? 'text-warning' : 'text-danger')}> · {pct}% de acerto</span>
            )}
          </span>
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-1">
        <ListDownloads id={list.id} title={list.title} />
        <ActionButton
          action={() => deleteMyList(list.id)}
          confirm="Excluir esta lista? Suas respostas nela também saem."
          success="Lista excluída"
          variant="ghost"
          size="sm"
          className="size-8 px-0 hover:text-danger"
          title="Excluir lista"
        >
          <Trash2 className="size-3.5" />
        </ActionButton>
      </div>
    </Card>
  );
}
