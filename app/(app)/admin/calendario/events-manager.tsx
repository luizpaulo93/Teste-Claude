'use client';

import { CalendarDays, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ActionForm } from '@/components/admin/action-form';
import { Badge, Button, Card, EmptyState, Field, Input, Select, Textarea } from '@/components/ui';
import { ActionButton, Modal, SubmitButton, Switch } from '@/components/ui-client';
import { EVENT_CATEGORIES, EVENT_COLORS } from '@/lib/calendar';
import type { CalendarEvent } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';
import { deleteEvent, saveEvent } from '../misc-actions';

export function EventsManager({ events }: { events: CalendarEvent[] }) {
  const [edit, setEdit] = useState<{ ev?: CalendarEvent } | null>(null);
  const [color, setColor] = useState('blue');
  const today = new Date().toISOString().slice(0, 10);

  const open = (ev?: CalendarEvent) => {
    setColor(ev?.color ?? 'blue');
    setEdit({ ev });
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => open()}>
          <Plus className="size-4" /> Novo evento
        </Button>
      </div>
      {events.length ? (
        <Card className="divide-y divide-line">
          {events.map((e) => (
            <div key={e.id} className={cn('flex items-center gap-3 p-3 sm:p-4', e.end_date < today && 'opacity-60')}>
              <span className={cn('size-3 shrink-0 rounded-full', (EVENT_COLORS[e.color] ?? EVENT_COLORS.blue).dot)} />
              <div className="w-24 shrink-0 text-xs font-bold text-ink-2 uppercase">
                {formatDate(e.start_date)}
                {e.end_date !== e.start_date && <span className="block font-medium text-muted normal-case">até {formatDate(e.end_date)}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{e.title}</p>
                <p className="text-xs text-muted">{EVENT_CATEGORIES[e.category]}</p>
              </div>
              {!e.is_published && <Badge>Oculto</Badge>}
              <Button variant="ghost" size="sm" className="px-2" onClick={() => open(e)} aria-label="Editar">
                <Pencil className="size-4" />
              </Button>
              <ActionButton action={() => deleteEvent(e.id)} confirm="Excluir evento?" success="Evento excluído" variant="ghost" size="sm" className="px-2 hover:text-danger" title="Excluir">
                <Trash2 className="size-4" />
              </ActionButton>
            </div>
          ))}
        </Card>
      ) : (
        <EmptyState icon={<CalendarDays className="size-6" />} title="Nenhum evento" description="Cadastre assuntos da semana, datas de simulados e revisões." />
      )}

      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.ev ? 'Editar evento' : 'Novo evento'}>
        {edit && (
          <ActionForm action={saveEvent} success="Evento salvo" onSuccess={() => setEdit(null)} className="space-y-4">
            {edit.ev && <input type="hidden" name="id" value={edit.ev.id} />}
            <input type="hidden" name="color" value={color} />
            <Field label="Título">
              <Input name="title" defaultValue={edit.ev?.title} required maxLength={160} autoFocus />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Início">
                <Input name="start_date" type="date" defaultValue={edit.ev?.start_date ?? today} required />
              </Field>
              <Field label="Fim">
                <Input name="end_date" type="date" defaultValue={edit.ev?.end_date ?? today} />
              </Field>
            </div>
            <Field label="Categoria">
              <Select name="category" defaultValue={edit.ev?.category ?? 'evento_curso'}>
                {Object.entries(EVENT_CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <div>
              <span className="text-xs font-semibold text-ink-2">Cor</span>
              <div className="mt-2 flex gap-2">
                {Object.entries(EVENT_COLORS).map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setColor(k)}
                    aria-label={v.label}
                    className={cn('size-8 rounded-full ring-offset-2 ring-offset-surface transition', v.dot, color === k && 'ring-2 ring-ink')}
                  />
                ))}
              </div>
            </div>
            <Field label="Descrição">
              <Textarea name="description" defaultValue={edit.ev?.description} rows={3} maxLength={2000} />
            </Field>
            <Switch name="is_published" defaultChecked={edit.ev?.is_published ?? true} label="Visível para alunos" />
            <div className="flex justify-end">
              <SubmitButton>Salvar evento</SubmitButton>
            </div>
          </ActionForm>
        )}
      </Modal>
    </>
  );
}
