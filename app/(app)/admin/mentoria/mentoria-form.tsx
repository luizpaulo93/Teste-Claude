'use client';

import { ActionForm } from '@/components/admin/action-form';
import { Field, Input, Select, Textarea } from '@/components/ui';
import { SubmitButton } from '@/components/ui-client';
import type { Mentoria } from '@/lib/types';
import { saveMentoria } from '../misc-actions';

export function MentoriaForm({ mentoria, onSaved }: { mentoria?: Mentoria; onSaved: (id?: string) => void }) {
  return (
    <ActionForm action={saveMentoria} success="Mentoria salva" onSuccess={(r) => onSaved(r.id)} className="space-y-4">
      {mentoria && <input type="hidden" name="id" value={mentoria.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="E-mail do aluno">
          <Input name="student_email" type="email" required defaultValue={mentoria?.student_email} />
        </Field>
        <Field label="Nome do aluno">
          <Input name="student_name" defaultValue={mentoria?.student_name} maxLength={160} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome da prova / objetivo">
          <Input name="exam_target" defaultValue={mentoria?.exam_target} placeholder="ENEM 2027 — Medicina" maxLength={120} />
        </Field>
        <Field label="Data da prova">
          <Input name="exam_date" type="date" defaultValue={mentoria?.exam_date ?? ''} />
        </Field>
        <input type="hidden" name="weekly_hours_target" value={mentoria?.weekly_hours_target ?? 20} />
      </div>
      <Field label="Meta principal">
        <Textarea name="goal" defaultValue={mentoria?.goal} rows={3} maxLength={600} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Início">
          <Input name="start_date" type="date" defaultValue={mentoria?.start_date} />
        </Field>
        <Field label="Fim da mentoria">
          <Input name="end_date" type="date" defaultValue={mentoria?.end_date ?? ''} />
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={mentoria?.status ?? 'active'}>
            <option value="active">Ativa</option>
            <option value="paused">Pausada</option>
            <option value="ended">Encerrada</option>
          </Select>
        </Field>
      </div>
      <div className="flex justify-end">
        <SubmitButton>Salvar</SubmitButton>
      </div>
    </ActionForm>
  );
}
