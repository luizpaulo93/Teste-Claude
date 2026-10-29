'use client';

import { FileText, X } from 'lucide-react';
import { useState } from 'react';
import { ActionForm } from '@/components/admin/action-form';
import { PdfDrop } from '@/components/admin/uploads';
import { Field, Input, Select, Textarea } from '@/components/ui';
import { SubmitButton, Switch } from '@/components/ui-client';
import { ENEM_AREAS, type Simulado } from '@/lib/types';
import { saveSimulado } from '../simulado-actions';

export function SimuladoForm({ simulado, answerKey = '', onSaved }: { simulado?: Simulado; answerKey?: string; onSaved?: () => void }) {
  const [pdf, setPdf] = useState(simulado?.pdf_path ?? '');
  const [count, setCount] = useState(simulado?.question_count ?? 45);
  const [key, setKey] = useState(answerKey);
  const clean = key.toUpperCase().replace(/[^A-E]/g, '');

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
      <Field
        label="Gabarito oficial"
        hint={
          <span className={clean.length === count ? 'text-success' : clean.length ? 'text-warning' : ''}>
            {clean.length}/{count} letras · digite em sequência (ex.: ABCDE…). Espaços e números são ignorados.
          </span>
        }
      >
        <Textarea name="answer_key" value={key} onChange={(e) => setKey(e.target.value)} rows={3} className="font-mono tracking-widest uppercase" placeholder="ABCDEABCDE…" />
      </Field>
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
