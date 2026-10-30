'use client';

import { Check, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from '@/components/toast';
import { buttonClass, Field, Input } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import { cn } from '@/lib/utils';
import { saveGroup, type GroupInput } from './group-actions';

export interface GroupFormData extends Omit<GroupInput, 'exam_date' | 'start_date' | 'end_date'> {
  exam_date: string | null;
  start_date: string;
  end_date: string | null;
}

/** Mentoria em grupo: escolha aluno por aluno, uma turma ou várias turmas inteiras. */
export function GroupForm({
  group,
  students,
  classes,
  onDone,
}: {
  group?: GroupFormData;
  students: { email: string; name: string; class_id: string | null }[];
  classes: { id: string; name: string; count: number }[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(group?.name ?? '');
  const [exam, setExam] = useState(group?.exam_target ?? '');
  const [examDate, setExamDate] = useState(group?.exam_date ?? '');
  const [start, setStart] = useState(group?.start_date ?? new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(group?.end_date ?? '');
  const [cls, setCls] = useState<string[]>(group?.class_ids ?? []);
  const [emails, setEmails] = useState<string[]>(group?.student_emails ?? []);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const term = q.trim().toLowerCase();
  const shown = students.filter((s) => !term || s.email.includes(term) || s.name.toLowerCase().includes(term)).slice(0, 60);
  const className = (id: string | null) => classes.find((c) => c.id === id)?.name;

  async function save() {
    setBusy(true);
    const r = await saveGroup({
      id: group?.id,
      name,
      description: group?.description ?? '',
      student_emails: emails,
      class_ids: cls,
      exam_target: exam,
      exam_date: examDate,
      start_date: start,
      end_date: end,
    });
    setBusy(false);
    if (r.error) return toast.error(r.error);
    toast('Mentoria em grupo salva');
    onDone?.();
    if (!group && r.id) router.push(`/admin/mentoria/grupo/${r.id}`);
    else router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome do grupo">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Ex.: Mentoria Medicina 2026" />
        </Field>
        <Field label="Nome da prova / objetivo">
          <Input value={exam} onChange={(e) => setExam(e.target.value)} maxLength={120} placeholder="ENEM 2026" />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Data da prova">
          <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
        </Field>
        <Field label="Início">
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Fim">
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-bold text-ink">Turmas inteiras</p>
        {classes.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {classes.map((c) => {
              const on = cls.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCls((l) => (on ? l.filter((x) => x !== c.id) : [...l, c.id]))}
                  aria-pressed={on}
                  className={cn('flex items-center gap-2.5 rounded-xl border p-3 text-left transition', on ? 'border-brand bg-brand/10' : 'border-line hover:bg-surface-2')}
                >
                  <Box on={on} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{c.name}</span>
                    <span className="block text-[11px] text-muted">{c.count} alunos</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted">Nenhuma turma cadastrada.</p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-bold text-ink">
          Alunos um a um <span className="font-normal text-muted">({emails.length} escolhidos)</span>
        </p>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar aluno por nome ou e-mail" className="pl-10" />
        </div>
        <ul className="scrollbar-thin max-h-60 divide-y divide-line overflow-y-auto rounded-xl border border-line">
          {shown.map((s) => {
            const on = emails.includes(s.email);
            const viaClass = s.class_id && cls.includes(s.class_id);
            return (
              <li key={s.email}>
                <button
                  type="button"
                  onClick={() => setEmails((l) => (on ? l.filter((x) => x !== s.email) : [...l, s.email]))}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-2"
                >
                  <Box on={on || Boolean(viaClass)} dim={Boolean(viaClass) && !on} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{s.name}</span>
                    <span className="block truncate text-[11px] text-muted">
                      {s.email}
                      {className(s.class_id) ? ` · ${className(s.class_id)}` : ''}
                      {viaClass ? ' · já entra pela turma' : ''}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {!shown.length && <li className="p-4 text-center text-xs text-muted">Nenhum aluno encontrado.</li>}
        </ul>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={save} disabled={busy} className={buttonClass('primary', 'md')}>
          {busy && <Spinner />} Salvar mentoria em grupo
        </button>
      </div>
    </div>
  );
}

function Box({ on, dim }: { on: boolean; dim?: boolean }) {
  return (
    <span className={cn('grid size-5 shrink-0 place-items-center rounded-md border-2', on ? (dim ? 'border-brand/50 bg-brand/40 text-white' : 'border-brand bg-brand text-white') : 'border-line-strong')}>
      {on && <Check className="size-3.5" strokeWidth={3} />}
    </span>
  );
}
