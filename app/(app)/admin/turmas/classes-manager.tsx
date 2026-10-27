'use client';

import { Pencil, Plus, Trash2, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ActionForm } from '@/components/admin/action-form';
import { Badge, Button, Card, Checkbox, EmptyState, Field, Input, Textarea } from '@/components/ui';
import { ActionButton, Modal, SubmitButton, Switch } from '@/components/ui-client';
import type { ClassGroup, Course } from '@/lib/types';
import { deleteClass, saveClass } from '../people-actions';

export function ClassesManager({
  classes,
  links,
  courses,
  counts,
}: {
  classes: ClassGroup[];
  links: { class_id: string; course_id: string }[];
  courses: Pick<Course, 'id' | 'title' | 'is_free'>[];
  counts: Record<string, number>;
}) {
  const [edit, setEdit] = useState<{ cls?: ClassGroup } | null>(null);
  const coursesOf = (id: string) => links.filter((l) => l.class_id === id).map((l) => l.course_id);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEdit({})}>
          <Plus className="size-4" /> Nova turma
        </Button>
      </div>
      {classes.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((c) => {
            const ids = coursesOf(c.id);
            return (
              <Card key={c.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink">{c.name}</p>
                    {c.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{c.description}</p>}
                  </div>
                  <Link href={`/admin/alunos?turma=${c.id}`}>
                    <Badge tone="brand">
                      <UsersRound className="size-3" /> {counts[c.id] ?? 0}
                    </Badge>
                  </Link>
                </div>
                <div className="mt-4 flex flex-1 flex-wrap content-start gap-1.5">
                  {c.access_all ? (
                    <Badge tone="success">Acesso a todos os cursos</Badge>
                  ) : ids.length ? (
                    ids.map((id) => <Badge key={id}>{courses.find((x) => x.id === id)?.title ?? '—'}</Badge>)
                  ) : (
                    <Badge tone="warning">Nenhum curso liberado</Badge>
                  )}
                </div>
                <div className="mt-4 flex justify-end gap-1 border-t border-line pt-3">
                  <Button variant="ghost" size="sm" onClick={() => setEdit({ cls: c })}>
                    <Pencil className="size-3.5" /> Editar
                  </Button>
                  <ActionButton
                    action={() => deleteClass(c.id)}
                    confirm={`Excluir a turma "${c.name}"? Os alunos ficarão sem turma (sem acesso).`}
                    success="Turma excluída"
                    variant="ghost"
                    size="sm"
                    className="hover:text-danger"
                    title="Excluir"
                  >
                    <Trash2 className="size-3.5" />
                  </ActionButton>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={<UsersRound className="size-6" />} title="Nenhuma turma" description="Crie uma turma (ex.: “Extensivo 2027”) e escolha os cursos liberados." />
      )}

      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.cls ? 'Editar turma' : 'Nova turma'} size="lg">
        {edit && (
          <ActionForm action={saveClass} success="Turma salva" onSuccess={() => setEdit(null)} className="space-y-4">
            {edit.cls && <input type="hidden" name="id" value={edit.cls.id} />}
            <Field label="Nome da turma">
              <Input name="name" defaultValue={edit.cls?.name} required maxLength={120} autoFocus />
            </Field>
            <Field label="Descrição">
              <Textarea name="description" defaultValue={edit.cls?.description} rows={2} maxLength={1000} />
            </Field>
            <Switch name="access_all" defaultChecked={edit.cls?.access_all} label="Acesso total" description="Libera todos os cursos, inclusive os criados no futuro" />
            <div>
              <p className="mb-2 text-xs font-semibold text-ink-2">Cursos liberados</p>
              <div className="grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-line p-3 sm:grid-cols-2">
                {courses.map((c) => (
                  <Checkbox key={c.id} name="course_ids" value={c.id} defaultChecked={edit.cls ? coursesOf(edit.cls.id).includes(c.id) : false} label={c.title} />
                ))}
                {!courses.length && <p className="text-sm text-muted">Crie cursos primeiro.</p>}
              </div>
            </div>
            <div className="flex justify-end">
              <SubmitButton>Salvar turma</SubmitButton>
            </div>
          </ActionForm>
        )}
      </Modal>
    </>
  );
}
