'use client';

import { Check, ChevronRight, ClipboardCheck, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { checkAssuntos, createCheckList, deleteCheckList } from '@/app/(app)/mentoria/actions';
import { toast } from '@/components/toast';
import { Button, Field, Select } from '@/components/ui';
import { ActionButton, Modal, Spinner } from '@/components/ui-client';
import { taxOrder } from '@/lib/taxonomy';
import { cn } from '@/lib/utils';

export interface CheckView {
  id: string;
  discipline: string;
  assunto: string;
  list_id: string;
  round: number;
  auto: boolean;
  status: 'open' | 'passed' | 'failed';
  ok: number | null;
  total: number | null;
}

/**
 * Listas de verificação da mentoria: 6 questões do assunto. Se o aluno acertar menos de 4,
 * o app cria outra lista do mesmo assunto sozinho. `mentoriaId` = visão do mentor (cria e apaga).
 */
export function Checks({ checks, mentoriaId }: { checks: CheckView[]; mentoriaId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<{ disciplina: string; assunto: string; n: number }[] | null>(null);
  const [disc, setDisc] = useState('');
  const [assunto, setAssunto] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open && !opts)
      checkAssuntos()
        .then(setOpts)
        .catch(() => setOpts([]));
  }, [open, opts]);
  const discs = useMemo(() => [...new Set((opts ?? []).map((o) => o.disciplina))], [opts]);
  const assuntos = useMemo(() => {
    const of = (opts ?? []).filter((o) => o.disciplina === disc);
    return taxOrder(of.map((o) => o.assunto)).map((a) => of.find((o) => o.assunto === a)!);
  }, [opts, disc]);

  async function create() {
    if (!mentoriaId || !disc || !assunto) return toast.error('Escolha a disciplina e o assunto.');
    setBusy(true);
    const r = await createCheckList(mentoriaId, disc, assunto).catch(() => ({ error: 'Não foi possível criar agora.' }) as { error: string });
    setBusy(false);
    if (r.error) return toast.error(r.error);
    toast('Lista de verificação criada para o aluno');
    setOpen(false);
    setAssunto('');
    router.refresh();
  }

  const pending = checks.filter((c) => c.status === 'open');
  const done = checks.filter((c) => c.status !== 'open');
  if (!mentoriaId && !checks.length) return null;
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-bold text-ink">
          <ClipboardCheck className="size-4 shrink-0 text-brand" /> <span className="truncate">Listas de verificação</span>
        </h2>
        {mentoriaId && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Nova lista
          </Button>
        )}
      </div>
      {mentoriaId && !checks.length && <p className="text-xs text-muted">6 questões do assunto que você escolher. Menos de 4 acertos: o app cria outra lista sozinho.</p>}
      <ul className="space-y-2">
        {[...pending, ...done].map((c) => {
          const tone = c.status === 'passed' ? 'border-success/40' : c.status === 'failed' ? 'border-danger/40' : 'border-brand/40';
          return (
            <li key={c.id} className={cn('flex items-center gap-3 rounded-2xl border bg-surface p-3', tone)}>
              <span
                className={cn(
                  'grid size-9 shrink-0 place-items-center rounded-xl',
                  c.status === 'passed' ? 'bg-success/12 text-success' : c.status === 'failed' ? 'bg-danger/12 text-danger' : 'bg-brand/12 text-brand',
                )}
              >
                {c.status === 'passed' ? <Check className="size-4" /> : c.status === 'failed' ? <X className="size-4" /> : <ClipboardCheck className="size-4" />}
              </span>
              <Link href={`/listas/${c.list_id}`} className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold text-brand uppercase">
                  {c.discipline}
                  {c.round > 1 && <span className="text-muted normal-case"> · {c.round}ª lista</span>}
                  {c.auto && (
                    <span className="ml-1 inline-flex items-center gap-0.5 text-amber-500 normal-case">
                      <RotateCcw className="size-3" /> automática
                    </span>
                  )}
                </span>
                <span className="block text-sm font-semibold break-words text-ink">{c.assunto}</span>
                <span className={cn('block text-xs', c.status === 'passed' ? 'text-success' : c.status === 'failed' ? 'text-danger' : 'text-muted')}>
                  {c.status === 'open'
                    ? mentoriaId
                      ? 'Aguardando o aluno'
                      : 'Responda as 6 questões'
                    : `${c.ok}/${c.total} acertos · ${c.status === 'passed' ? 'aprendeu' : 'precisa revisar'}`}
                </span>
              </Link>
              {mentoriaId ? (
                <ActionButton
                  action={async () => {
                    const r = await deleteCheckList(mentoriaId, c.id);
                    router.refresh();
                    return r;
                  }}
                  confirm="Apagar esta lista de verificação?"
                  success="Lista apagada"
                  variant="ghost"
                  size="sm"
                  className="size-8 shrink-0 px-0 hover:text-danger"
                  title="Apagar lista"
                >
                  <Trash2 className="size-3.5" />
                </ActionButton>
              ) : (
                <Link
                  href={`/listas/${c.list_id}`}
                  className={cn('flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold', c.status === 'open' ? 'bg-brand text-white' : 'text-brand')}
                >
                  {c.status === 'open' ? 'Fazer' : 'Ver'} <ChevronRight className="size-3.5" />
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {mentoriaId && (
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="Nova lista de verificação"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={create} disabled={busy || !assunto}>
                {busy ? <Spinner /> : <Plus className="size-4" />} Criar lista
              </Button>
            </>
          }
        >
          {!opts ? (
            <Spinner />
          ) : (
            <div className="space-y-3">
              <Field label="Disciplina">
                <Select
                  value={disc}
                  onChange={(e) => {
                    setDisc(e.target.value);
                    setAssunto('');
                  }}
                  aria-label="Disciplina"
                >
                  <option value="">Escolha</option>
                  {discs.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Assunto">
                <Select value={assunto} onChange={(e) => setAssunto(e.target.value)} aria-label="Assunto" disabled={!disc}>
                  <option value="">Escolha</option>
                  {assuntos.map((a) => (
                    <option key={a.assunto} value={a.assunto}>
                      {a.assunto} ({a.n})
                    </option>
                  ))}
                </Select>
              </Field>
              <p className="text-[11px] text-muted">6 questões sorteadas do assunto. Menos de 4 acertos: outra lista é criada sozinha.</p>
            </div>
          )}
        </Modal>
      )}
    </section>
  );
}
