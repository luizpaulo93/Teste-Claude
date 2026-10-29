'use client';

import { ActionForm } from '@/components/admin/action-form';
import { ImageUpload } from '@/components/admin/uploads';
import { Field, Input, Textarea } from '@/components/ui';
import { SubmitButton, Switch } from '@/components/ui-client';
import type { Course } from '@/lib/types';
import { saveCourse } from '../content-actions';

export function CourseForm({ course, onSaved }: { course?: Course; onSaved?: (id: string) => void }) {
  return (
    <ActionForm action={saveCourse} success={course ? 'Curso atualizado' : 'Curso criado'} onSuccess={(r) => r.id && onSaved?.(r.id)} className="space-y-5">
      {course && <input type="hidden" name="id" value={course.id} />}
      <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-ink-2">Capa (2:3)</span>
          <ImageUpload name="cover_url" defaultValue={course?.cover_url} folder="courses" colors />
        </div>
        <div className="space-y-4">
          <Field label="Título">
            <Input name="title" defaultValue={course?.title} required maxLength={160} placeholder="Ex.: Física para o ENEM" />
          </Field>
          <Field label="Subtítulo">
            <Input name="subtitle" defaultValue={course?.subtitle} maxLength={240} />
          </Field>
          <Field label="Categoria">
            <Input name="category" defaultValue={course?.category} maxLength={80} placeholder="Ex.: Física" />
          </Field>
        </div>
      </div>
      <Field label="Descrição">
        <Textarea name="description" defaultValue={course?.description} maxLength={3000} rows={4} />
      </Field>
      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-ink-2">Banner (16:6)</span>
        <ImageUpload name="banner_url" defaultValue={course?.banner_url} folder="banners" aspect="aspect-[16/6]" maxSize={1920} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Switch name="is_published" defaultChecked={course?.is_published ?? true} label="Publicado" description="Visível na vitrine" />
        <Switch name="featured" defaultChecked={course?.featured} label="Destaque" description="Aparece no topo da home" />
        <Switch name="is_free" defaultChecked={course?.is_free} label="Gratuito" description="Liberado para todos" />
      </div>
      <div className="flex justify-end">
        <SubmitButton>{course ? 'Salvar curso' : 'Criar curso'}</SubmitButton>
      </div>
    </ActionForm>
  );
}
