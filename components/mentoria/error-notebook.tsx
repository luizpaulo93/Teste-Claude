'use client';

import { BookX, Check, Eye, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ImageUpload } from '@/components/admin/uploads';
import { toast } from '@/components/toast';
import { Badge, buttonClass, Field, Input, Select, Textarea } from '@/components/ui';
import { ActionButton, Modal, Spinner } from '@/components/ui-client';
import { addError, deleteError, reviewError } from '@/app/(app)/mentoria/actions';
import { REVIEW_STEPS, SUBJECTS } from '@/lib/mentoria';
import { ERROR_REASONS, type ErrorReason, type MentoriaError } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';

/** Caderno de erros com revisão espaçada: anota o erro, revisa em 1, 7, 15 e 30 dias até dominar. */
export function ErrorNotebook({ errors, today, mentoriaId }: { errors: MentoriaError[]; today: string; mentoriaId?: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<'hoje' | 'todos'>('hoje');
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState('');
  const due = errors.filter((e) => !e.mastered && e.next_review <= today);
  const open = errors.filter((e) => !e.mastered);
  const mastered = errors.length - open.length;
  const list = (tab === 'hoje' ? due : errors).filter((e) => !filter || e.subject === filter);

  const reasons = useMemo(() => {
    const by = new Map<string, number>();
    open.forEach((e) => by.set(e.reason, (by.get(e.reason) ?? 0) + 1));
    return [...by.entries()].sort((a, b) => b[1] - a[1]);
  }, [open]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl border border-line bg-surface p-3">
          <p className="text-2xl font-extrabold text-ink tabular-nums">{due.length}</p>
          <p className="text-[11px] text-muted">para revisar hoje</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-3">
          <p className="text-2xl font-extrabold text-ink tabular-nums">{open.length}</p>
          <p className="text-[11px] text-muted">em revisão</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-3">
          <p className="text-2xl font-extrabold text-success tabular-nums">{mastered}</p>
          <p className="text-[11px] text-muted">dominados</p>
        </div>
      </div>

      {reasons.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {reasons.map(([r, n]) => (
            <Badge key={r} tone={r === 'conteudo' ? 'warning' : 'neutral'}>
              {ERROR_REASONS[r as ErrorReason]} · {n}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-grid grid-cols-2 rounded-xl border border-line bg-surface p-1 text-sm font-semibold">
          {(['hoje', 'todos'] as const).map((k) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={cn('rounded-lg px-3 py-1.5', tab === k ? 'bg-brand text-white' : 'text-ink-2')}>
              {k === 'hoje' ? `Revisar hoje ${due.length}` : `Todos ${errors.length}`}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setAdding(true)} className={buttonClass('primary', 'md', 'ml-auto sm:order-last')}>
          <Plus className="size-4" /> Anotar erro
        </button>
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 w-full sm:w-56" aria-label="Matéria">
          <option value="">Todas as matérias</option>
          {SUBJECTS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      </div>

      {list.length ? (
        <ul className="space-y-3">
          {list.map((e) => (
            <ErrorCard key={e.id} e={e} today={today} mentoriaId={mentoriaId} onDone={() => router.refresh()} />
          ))}
        </ul>
      ) : (
        <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-line-strong p-8 text-center">
          <BookX className="size-6 text-muted" />
          <p className="text-sm font-semibold text-ink">{tab === 'hoje' ? 'Nada para revisar hoje' : 'Nenhum erro anotado'}</p>
          <p className="text-xs text-muted">Errou uma questão? Anote aqui: o app lembra de revisar em 1, 7, 15 e 30 dias.</p>
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Anotar erro">
        {adding && <AddErrorForm mentoriaId={mentoriaId} onDone={() => setAdding(false)} />}
      </Modal>
    </div>
  );
}

function ErrorCard({ e, today, mentoriaId, onDone }: { e: MentoriaError; today: string; mentoriaId?: string; onDone: () => void }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const isDue = !e.mastered && e.next_review <= today;
  const review = async (ok: boolean) => {
    setBusy(true);
    const r = await reviewError(e.id, ok, mentoriaId);
    setBusy(false);
    if (r.error) return toast.error(r.error);
    toast(ok ? (e.stage + 1 >= REVIEW_STEPS.length ? 'Dominado! 🎉' : `Próxima revisão em ${REVIEW_STEPS[e.stage + 1]} dias`) : 'Volta amanhã para revisar');
    onDone();
  };
  return (
    <li className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="brand">{e.subject}</Badge>
            <Badge>{ERROR_REASONS[e.reason]}</Badge>
            {e.mastered ? <Badge tone="success">Dominado</Badge> : <span className="text-[11px] text-muted">{isDue ? 'revisar hoje' : `revisão em ${formatDate(e.next_review)}`}</span>}
          </div>
          {e.topic && <p className="mt-1.5 text-sm font-bold text-ink">{e.topic}</p>}
        </div>
        <ActionButton action={() => deleteError(e.id, mentoriaId)} confirm="Excluir este erro do caderno?" variant="ghost" size="sm" className="px-1.5 hover:text-danger" title="Excluir">
          <Trash2 className="size-3.5" />
        </ActionButton>
      </div>
      {e.question && <p className="text-sm whitespace-pre-line text-ink-2">{e.question}</p>}
      {e.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={e.image_url} alt="" className="max-h-72 w-full rounded-xl border border-line object-contain" />
      )}
      {e.answer &&
        (show ? (
          <p className="rounded-xl bg-success/10 p-3 text-sm whitespace-pre-line text-ink">{e.answer}</p>
        ) : (
          <button type="button" onClick={() => setShow(true)} className="flex items-center gap-1.5 text-xs font-semibold text-brand">
            <Eye className="size-3.5" /> Ver resolução
          </button>
        ))}
      {isDue && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => review(false)} className={buttonClass('secondary', 'md')}>
            <X className="size-4 text-danger" /> Errei de novo
          </button>
          <button type="button" disabled={busy} onClick={() => review(true)} className={buttonClass('primary', 'md')}>
            {busy ? <Spinner /> : <Check className="size-4" />} Acertei
          </button>
        </div>
      )}
      {e.mastered && (
        <button type="button" onClick={() => review(false)} className="flex items-center gap-1.5 text-xs font-semibold text-muted">
          <RotateCcw className="size-3.5" /> Voltar a revisar
        </button>
      )}
    </li>
  );
}

function AddErrorForm({ mentoriaId, onDone }: { mentoriaId?: string; onDone: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function submit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    setBusy(true);
    const r = await addError(
      {
        subject: String(fd.get('subject')),
        topic: String(fd.get('topic') ?? ''),
        question: String(fd.get('question') ?? ''),
        reason: String(fd.get('reason')),
        answer: String(fd.get('answer') ?? ''),
        image_url: String(fd.get('image_url') ?? ''),
      },
      mentoriaId,
    );
    setBusy(false);
    if (r.error) return toast.error(r.error);
    toast('Erro anotado. Primeira revisão amanhã.');
    onDone();
    router.refresh();
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Matéria">
          <Select name="subject" defaultValue={SUBJECTS[0]}>
            {SUBJECTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Por que errou?">
          <Select name="reason" defaultValue="conteudo">
            {Object.entries(ERROR_REASONS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Assunto">
        <Input name="topic" maxLength={160} placeholder="Ex.: Função do 2º grau" />
      </Field>
      <Field label="Questão (ou foto)">
        <Textarea name="question" rows={3} maxLength={3000} placeholder="Cole o enunciado ou resuma a questão" />
      </Field>
      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-ink-2">Foto da questão</span>
        <ImageUpload name="image_url" folder="doubts" aspect="aspect-video max-w-xs" maxSize={1600} />
      </div>
      <Field label="Resolução / o que aprendi">
        <Textarea name="answer" rows={3} maxLength={3000} placeholder="A resposta certa e o porquê" />
      </Field>
      <div className="flex justify-end">
        <button type="submit" disabled={busy} className={buttonClass('primary', 'md')}>
          {busy && <Spinner />} Salvar no caderno
        </button>
      </div>
    </form>
  );
}
