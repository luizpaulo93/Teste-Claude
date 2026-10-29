'use client';

import { Check, FileText, ListChecks, X } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { ActionForm } from '@/components/admin/action-form';
import { PdfDrop } from '@/components/admin/uploads';
import { toast } from '@/components/toast';
import { buttonClass, Field, Input, Select } from '@/components/ui';
import { Modal, SubmitButton, Switch } from '@/components/ui-client';
import { cn } from '@/lib/utils';
import { ENEM_AREAS, type Simulado } from '@/lib/types';
import { saveAnswerKey, saveSimulado } from '../simulado-actions';

export function SimuladoForm({ simulado, answerKey = '', onSaved }: { simulado?: Simulado; answerKey?: string; onSaved?: () => void }) {
  const [pdf, setPdf] = useState(simulado?.pdf_path ?? '');
  const [count, setCount] = useState(simulado?.question_count ?? 45);
  const [key, setKey] = useState(() => fitKey(answerKey, simulado?.question_count ?? 45));
  // Gabarito acompanha o nº de questões (novas bolhas nascem em A)
  useEffect(() => setKey((k) => fitKey(k, count)), [count]);

  return (
    <ActionForm action={saveSimulado} success="Simulado salvo" onSuccess={onSaved} className="space-y-4">
      {simulado && <input type="hidden" name="id" value={simulado.id} />}
      <input type="hidden" name="pdf_path" value={pdf} />
      <Field label="Título">
        <Input name="title" defaultValue={simulado?.title} required maxLength={160} placeholder="Ex.: 1º Simulado ENEM — Matemática" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Área">
          <Select name="area" defaultValue={simulado?.area ?? 'MT'}>
            {Object.entries(ENEM_AREAS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nº de questões">
          <Input name="question_count" type="number" min={1} max={180} value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} required />
        </Field>
        <Field label="Tempo (min)" hint="0 = tempo livre">
          <Input name="time_limit_minutes" type="number" min={0} max={600} defaultValue={simulado?.time_limit_minutes ?? 0} />
        </Field>
      </div>
      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-ink-2">Caderno de questões (PDF)</span>
        {pdf ? (
          <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 p-3 text-sm">
            <FileText className="size-4 text-danger" /> <span className="flex-1 truncate text-ink">{pdf.split('/').pop()}</span>
            <button type="button" onClick={() => setPdf('')} className="text-muted hover:text-danger" aria-label="Remover PDF">
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <PdfDrop folder="simulados" onUploaded={(r) => setPdf(r.path)} label="Enviar PDF da prova" />
        )}
      </div>
      <input type="hidden" name="answer_key" value={key} />
      <AnswerKeyButton simuladoId={simulado?.id} count={count} value={key} onChange={setKey} />
      <Switch
        name="use_tri"
        defaultChecked={simulado?.use_tri ?? true}
        label="Calcular nota TRI"
        description="Desligado: o aluno vê só o número de acertos e os dados por questão"
      />
      <Switch name="is_published" defaultChecked={simulado?.is_published} label="Publicado" description="Alunos liberados podem iniciar a prova" />
      <div className="flex justify-end">
        <SubmitButton>Salvar simulado</SubmitButton>
      </div>
    </ActionForm>
  );
}

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

function fitKey(key: string, count: number) {
  const clean = key.toUpperCase().replace(/[^A-E]/g, '').slice(0, count);
  return clean + 'A'.repeat(Math.max(0, count - clean.length));
}

/** Botão do gabarito: abre um popup com as bolhas para marcar. */
function AnswerKeyButton({
  simuladoId,
  count,
  value,
  onChange,
}: {
  simuladoId?: string;
  count: number;
  value: string;
  onChange: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      if (simuladoId) {
        const res = await saveAnswerKey(simuladoId, draft);
        if (res && 'error' in res && res.error) return void toast.error(res.error);
        toast('Gabarito salvo · notas atualizadas');
      }
      onChange(draft);
      setOpen(false);
    });

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDraft(fitKey(value, count));
          setOpen(true);
        }}
        className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2/60 p-3.5 text-left transition hover:border-brand/60"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand">
          <ListChecks className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">Gabarito oficial</span>
          <span className="block truncate font-mono text-xs tracking-wider text-muted">{value.slice(0, 40)}{value.length > 40 ? '…' : ''}</span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-brand">Editar</span>
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Gabarito · ${count} questões`}
        size="md"
        footer={
          <button type="button" onClick={save} disabled={pending} className={buttonClass('primary', 'md', 'w-full sm:w-auto')}>
            <Check className="size-4" /> {pending ? 'Salvando…' : 'Salvar gabarito'}
          </button>
        }
      >
        <ol className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {Array.from({ length: count }, (_, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="w-7 shrink-0 text-right text-xs font-bold text-muted tabular-nums">{i + 1}</span>
              {LETTERS.map((letter) => {
                const on = draft[i] === letter;
                return (
                  <button
                    key={letter}
                    type="button"
                    aria-label={`Questão ${i + 1}: ${letter}`}
                    aria-pressed={on}
                    onClick={() => setDraft((d) => d.slice(0, i) + letter + d.slice(i + 1))}
                    className={cn(
                      'grid size-8 place-items-center rounded-full border text-xs font-bold transition',
                      on ? 'border-brand bg-brand text-white' : 'border-line-strong text-ink-2 hover:border-brand/60',
                    )}
                  >
                    {letter}
                  </button>
                );
              })}
            </li>
          ))}
        </ol>
      </Modal>
    </>
  );
}
