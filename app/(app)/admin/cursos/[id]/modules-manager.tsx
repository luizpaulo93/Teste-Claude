'use client';

import { ArrowDown, ArrowUp, Eye, EyeOff, FileText, FolderPlus, GripVertical, Pencil, Plus, Trash2, Video, X } from 'lucide-react';
import { useState } from 'react';
import { ActionForm } from '@/components/admin/action-form';
import { ImageUpload, PdfDrop } from '@/components/admin/uploads';
import { Badge, Button, Card, EmptyState, Field, Img, Input, Textarea } from '@/components/ui';
import { ActionButton, Modal, SubmitButton, Switch } from '@/components/ui-client';
import type { Lesson, LessonMaterial, Module } from '@/lib/types';
import { cn, youtubeThumb } from '@/lib/utils';
import { deleteLesson, deleteModule, moveItem, saveLesson, saveModule, toggleLessonFlag } from '../../content-actions';

type LessonModal = { lesson?: Lesson; moduleId: string } | null;

export function ModulesManager({
  courseId,
  modules,
  lessons,
}: {
  courseId: string;
  modules: Module[];
  lessons: Lesson[];
}) {
  const [moduleModal, setModuleModal] = useState<{ module?: Module } | null>(null);
  const [lessonModal, setLessonModal] = useState<LessonModal>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-ink">
          {modules.length} módulos · {lessons.length} aulas
        </p>
        <Button onClick={() => setModuleModal({})}>
          <FolderPlus className="size-4" /> Novo módulo
        </Button>
      </div>

      {!modules.length && (
        <EmptyState icon={<FolderPlus className="size-6" />} title="Nenhum módulo ainda" description="Crie um módulo (ex.: “Cinemática”) e depois adicione as aulas dentro dele." />
      )}

      {modules.map((m, mi) => {
        const ml = lessons.filter((l) => l.module_id === m.id);
        return (
          <Card key={m.id} className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line bg-surface-2/50 p-3 sm:p-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-xs font-extrabold text-brand">{mi + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-ink">{m.title}</p>
                <p className="text-xs text-muted">
                  {ml.length} aulas {!m.is_published && '· oculto'}
                </p>
              </div>
              <ActionButton action={() => moveItem('modules', m.id, -1, { column: 'course_id', value: courseId })} variant="ghost" size="sm" className="px-1.5" title="Subir">
                <ArrowUp className="size-4" />
              </ActionButton>
              <ActionButton action={() => moveItem('modules', m.id, 1, { column: 'course_id', value: courseId })} variant="ghost" size="sm" className="px-1.5" title="Descer">
                <ArrowDown className="size-4" />
              </ActionButton>
              <Button variant="ghost" size="sm" className="px-1.5" onClick={() => setModuleModal({ module: m })} aria-label="Editar módulo">
                <Pencil className="size-4" />
              </Button>
              <ActionButton
                action={() => deleteModule(m.id, courseId)}
                confirm={`Excluir o módulo "${m.title}" e suas ${ml.length} aulas?`}
                success="Módulo excluído"
                variant="ghost"
                size="sm"
                className="px-1.5 hover:text-danger"
                title="Excluir módulo"
              >
                <Trash2 className="size-4" />
              </ActionButton>
            </div>
            <ul className="divide-y divide-line">
              {ml.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                  <GripVertical className="hidden size-4 text-muted/50 sm:block" />
                  <div className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                    {l.thumbnail_url || l.youtube_id ? (
                      <Img src={l.thumbnail_url || youtubeThumb(l.youtube_id)} className="size-full object-cover" />
                    ) : (
                      <div className="grid size-full place-items-center text-muted">
                        <FileText className="size-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => setLessonModal({ lesson: l, moduleId: m.id })} className="line-clamp-1 text-left text-sm font-semibold text-ink hover:text-brand">
                      {l.title}
                    </button>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {!l.is_published && <Badge>Oculta</Badge>}
                      {l.is_free && <Badge tone="success">Grátis</Badge>}
                      {l.youtube_id && (
                        <Badge tone="brand">
                          <Video className="size-3" /> vídeo
                        </Badge>
                      )}
                      {(l.materials?.length ?? 0) > 0 && (
                        <Badge>
                          <FileText className="size-3" /> {l.materials!.length} PDF
                        </Badge>
                      )}
                      {l.duration && <span className="text-[11px] text-muted">{l.duration}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <ActionButton action={() => moveItem('lessons', l.id, -1, { column: 'module_id', value: m.id })} variant="ghost" size="sm" className="hidden px-1.5 sm:inline-flex" title="Subir">
                      <ArrowUp className="size-3.5" />
                    </ActionButton>
                    <ActionButton action={() => moveItem('lessons', l.id, 1, { column: 'module_id', value: m.id })} variant="ghost" size="sm" className="hidden px-1.5 sm:inline-flex" title="Descer">
                      <ArrowDown className="size-3.5" />
                    </ActionButton>
                    <ActionButton
                      action={() => toggleLessonFlag(l.id, courseId, 'is_published', !l.is_published)}
                      variant="ghost"
                      size="sm"
                      className="px-1.5"
                      title={l.is_published ? 'Ocultar' : 'Publicar'}
                    >
                      {l.is_published ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                    </ActionButton>
                    <ActionButton
                      action={() => deleteLesson(l.id, courseId)}
                      confirm={`Excluir a aula "${l.title}"?`}
                      success="Aula excluída"
                      variant="ghost"
                      size="sm"
                      className="px-1.5 hover:text-danger"
                      title="Excluir aula"
                    >
                      <Trash2 className="size-3.5" />
                    </ActionButton>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setLessonModal({ moduleId: m.id })}
              className="flex w-full items-center justify-center gap-2 border-t border-line py-3 text-sm font-semibold text-brand transition hover:bg-brand-soft"
            >
              <Plus className="size-4" /> Adicionar aula
            </button>
          </Card>
        );
      })}

      <Modal open={Boolean(moduleModal)} onClose={() => setModuleModal(null)} title={moduleModal?.module ? 'Editar módulo' : 'Novo módulo'}>
        {moduleModal && (
          <ActionForm action={saveModule} success="Módulo salvo" onSuccess={() => setModuleModal(null)} className="space-y-4">
            <input type="hidden" name="course_id" value={courseId} />
            {moduleModal.module && <input type="hidden" name="id" value={moduleModal.module.id} />}
            <Field label="Nome do módulo">
              <Input name="title" defaultValue={moduleModal.module?.title} required maxLength={160} autoFocus />
            </Field>
            <Field label="Descrição (opcional)">
              <Textarea name="description" defaultValue={moduleModal.module?.description} maxLength={1500} rows={3} />
            </Field>
            <Switch name="is_published" defaultChecked={moduleModal.module?.is_published ?? true} label="Visível para alunos" />
            <div className="flex justify-end">
              <SubmitButton>Salvar módulo</SubmitButton>
            </div>
          </ActionForm>
        )}
      </Modal>

      <Modal open={Boolean(lessonModal)} onClose={() => setLessonModal(null)} title={lessonModal?.lesson ? 'Editar aula' : 'Nova aula'} size="lg">
        {lessonModal && (
          <LessonForm
            courseId={courseId}
            moduleId={lessonModal.moduleId}
            modules={modules}
            lesson={lessonModal.lesson}
            materials={lessonModal.lesson?.materials ?? []}
            onDone={() => setLessonModal(null)}
          />
        )}
      </Modal>
    </div>
  );
}

interface MaterialDraft {
  id?: string;
  title: string;
  file_path: string;
  size_label: string;
}

function LessonForm({
  courseId,
  moduleId,
  modules,
  lesson,
  materials,
  onDone,
}: {
  courseId: string;
  moduleId: string;
  modules: Module[];
  lesson?: Lesson;
  materials: LessonMaterial[];
  onDone: () => void;
}) {
  const [mats, setMats] = useState<MaterialDraft[]>(materials.map((m) => ({ id: m.id, title: m.title, file_path: m.file_path, size_label: m.size_label })));
  const move = (i: number, d: number) =>
    setMats((list) => {
      const j = i + d;
      if (j < 0 || j >= list.length) return list;
      const n = [...list];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  return (
    <ActionForm action={saveLesson} success={lesson ? 'Aula atualizada' : 'Aula criada'} onSuccess={onDone} className="space-y-4">
      <input type="hidden" name="course_id" value={courseId} />
      {lesson && <input type="hidden" name="id" value={lesson.id} />}
      <input type="hidden" name="materials" value={JSON.stringify(mats)} />
      <Field label="Título da aula">
        <Input name="title" defaultValue={lesson?.title} required maxLength={160} autoFocus={!lesson} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <Field label="Link do vídeo no YouTube" hint="Pode ser não listado. Deixe vazio para aula só com PDF.">
          <Input name="youtube" defaultValue={lesson?.youtube_id ? `https://youtu.be/${lesson.youtube_id}` : ''} placeholder="https://youtu.be/..." />
        </Field>
        <Field label="Duração">
          <Input name="duration" defaultValue={lesson?.duration} maxLength={16} placeholder="18:40" />
        </Field>
      </div>
      <Field label="Módulo">
        <select name="module_id" defaultValue={lesson?.module_id ?? moduleId} className="h-11 w-full rounded-xl border border-line-strong bg-bg-elev px-3 text-sm text-ink">
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Descrição / links">
        <Textarea name="description" defaultValue={lesson?.description} maxLength={4000} rows={3} />
      </Field>
      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-ink-2">Capa da aula (opcional — usa a miniatura do YouTube se vazio)</span>
        <ImageUpload name="thumbnail_url" defaultValue={lesson?.thumbnail_url} folder="lessons" aspect="aspect-video max-w-xs" maxSize={1280} />
      </div>

      <div className="space-y-2">
        <span className="text-xs font-semibold text-ink-2">Materiais em PDF</span>
        {mats.map((m, i) => (
          <div key={m.file_path} className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 p-2">
            <FileText className="size-4 shrink-0 text-danger" />
            <input
              value={m.title}
              onChange={(e) => setMats((list) => list.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
              maxLength={160}
            />
            <span className="text-[11px] text-muted">{m.size_label}</span>
            <button type="button" onClick={() => move(i, -1)} className="p-1 text-muted hover:text-ink" aria-label="Subir">
              <ArrowUp className="size-3.5" />
            </button>
            <button type="button" onClick={() => move(i, 1)} className="p-1 text-muted hover:text-ink" aria-label="Descer">
              <ArrowDown className="size-3.5" />
            </button>
            <button type="button" onClick={() => setMats((list) => list.filter((_, k) => k !== i))} className="p-1 text-muted hover:text-danger" aria-label="Remover">
              <X className="size-4" />
            </button>
          </div>
        ))}
        {mats.length < 20 && (
          <PdfDrop multiple folder={`lessons/${courseId}`} label="Adicionar PDFs" onUploaded={(r) => setMats((list) => [...list, { title: r.title, file_path: r.path, size_label: r.size }])} />
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Switch name="is_published" defaultChecked={lesson?.is_published ?? true} label="Publicada" />
        <Switch name="is_free" defaultChecked={lesson?.is_free} label="Aula grátis" description="Liberada mesmo sem acesso ao curso" />
      </div>
      <div className={cn('flex justify-end gap-2')}>
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <SubmitButton>{lesson ? 'Salvar aula' : 'Criar aula'}</SubmitButton>
      </div>
    </ActionForm>
  );
}
