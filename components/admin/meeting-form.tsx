'use client';

import { ActionForm } from '@/components/admin/action-form';
import { Field, Input, Textarea } from '@/components/ui';
import { SubmitButton } from '@/components/ui-client';
import type { MentoriaMeeting } from '@/lib/types';
import { saveMeeting } from '@/app/(app)/admin/misc-actions';

function toLocalInput(iso?: string) {
  const d = iso ? new Date(iso) : new Date(Date.now() + 86400_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function tzOffset() {
  const m = -new Date().getTimezoneOffset();
  const sign = m >= 0 ? '+' : '-';
  const a = Math.abs(m);
  return `${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

export function MeetingForm({ meeting, mentoriaId, onDone }: { meeting?: MentoriaMeeting; mentoriaId?: string; onDone: () => void }) {
  return (
    <ActionForm action={saveMeeting} success="Encontro salvo" onSuccess={onDone} className="space-y-4">
      {meeting && <input type="hidden" name="id" value={meeting.id} />}
      <input type="hidden" name="mentoria_id" value={mentoriaId ?? ''} />
      <input type="hidden" name="tz_offset" value={tzOffset()} />
      <Field label="Título">
        <Input name="title" defaultValue={meeting?.title} required maxLength={160} autoFocus />
      </Field>
      <div className="grid grid-cols-[1fr_120px] gap-4">
        <Field label="Data e hora">
          <Input name="starts_at" type="datetime-local" defaultValue={toLocalInput(meeting?.starts_at)} required />
        </Field>
        <Field label="Duração (min)">
          <Input name="duration_min" type="number" min={5} max={600} defaultValue={meeting?.duration_min ?? 60} />
        </Field>
      </div>
      <Field label="Link (Meet, Zoom…)">
        <Input name="link" type="url" defaultValue={meeting?.link} placeholder="https://meet.google.com/..." />
      </Field>
      <Field label="Descrição">
        <Textarea name="description" defaultValue={meeting?.description} rows={2} maxLength={1000} />
      </Field>
      <Field label="Anotações internas">
        <Textarea name="notes" defaultValue={meeting?.notes} rows={2} maxLength={3000} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton>Salvar encontro</SubmitButton>
      </div>
    </ActionForm>
  );
}
