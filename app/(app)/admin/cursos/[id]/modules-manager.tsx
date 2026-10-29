'use client';

import { ArrowDown, ArrowLeft, ArrowUp, Check, ChevronRight, Eye, EyeOff, FileText, Folder, FolderPlus, Inbox, Pencil, Plus, Trash2, Video, X } from 'lucide-react';
import { useState, useTransition } from 'react';
import { ActionForm } from '@/components/admin/action-form';
import { LessonForm } from '@/components/admin/lesson-form';
import { toast } from '@/components/toast';
import { Badge, Button, Card, EmptyState, Field, Img, Input, Textarea } from '@/components/ui';
import { ActionButton, Modal, Spinner, SubmitButton, Switch } from '@/components/ui-client';
import type { Lesson, LessonFolder, Module } from '@/lib/types';
import { cn, youtubeThumb } from '@/lib/utils';
import { addLessonsToModule, deleteModule, moveItem, moveLessonInModule, removeLessonFromModule, saveModule, toggleLessonFlag } from '../../content-actions';

export type PickerLesson = Pick<Lesson, 'id' | 'title' | 'folder_id' | 'youtube_id' | 'thumbnail_url' | 'materials'>;

export function ModulesManager({
  courseId,
  modules,
  lessons,
  folders,
  bank,
}: {
  courseId: string;
  modules: Module[];
  lessons: Lesson[];
  folders: LessonFolder[];
  bank: PickerLesson[];
}) {
  const [moduleModal, setModuleModal] = useState<{ module?: Module } | null>(null);
  const [lessonModal, setLessonModal] = useState<{ lesson?: Lesson; moduleId: string } | null>(null);
  const [picker, setPicker] = useState<Module | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-ink">
          {modules.length} módulos · {new Set(lessons.map((l) => l.id)).size} aulas
        </p>
        <Button onClick={() => setModuleModal({})}>
          <FolderPlus className="size-4" /> Novo módulo
        </Button>
      </div>

      {!modules.length && (
        <EmptyState
          icon={<FolderPlus className="size-6" />}
          title="Nenhum módulo ainda"
          description="Crie um módulo (ex.: “Cinemática”) e depois adicione as aulas do banco de aulas (Admin → Aulas)."
        />
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
              <ActionButton action={() => moveItem('modules', m.id, -1, { column: 'course_id', value: courseId })} variant="ghost" size="sm" className="px-1.5" title="Subir" disabled={mi === 0}>
                <ArrowUp className="size-4" />
              </ActionButton>
              <ActionButton action={() => moveItem('modules', m.id, 1, { column: 'course_id', value: courseId })} variant="ghost" size="sm" className="px-1.5" title="Descer" disabled={mi === modules.length - 1}>
                <ArrowDown className="size-4" />
              </ActionButton>
              <Button variant="ghost" size="sm" className="px-1.5" onClick={() => setModuleModal({ module: m })} aria-label="Editar módulo">
                <Pencil className="size-4" />
              </Button>
              <ActionButton
                action={() => deleteModule(m.id, courseId)}
                confirm={`Excluir o módulo "${m.title}"? As aulas continuam no banco de aulas.`}
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
              {ml.map((l, li) => (
                <li key={l.id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                  <span className="w-5 shrink-0 text-center text-[11px] font-bold text-brand tabular-nums">{li + 1}.</span>
                  <div className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                    {l.thumbnail_url || l.youtube_id ? (
                      <Img src={l.thumbnail_url || youtubeThumb(l.youtube_id)} className="size-full object-cover" />
                    ) : (
                      <div className="grid size-full place-items-center text-danger">
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
                    <ActionButton action={() => moveLessonInModule(m.id, l.id, -1)} variant="ghost" size="sm" className="px-1.5" title="Subir" disabled={li === 0}>
                      <ArrowUp className="size-3.5" />
                    </ActionButton>
                    <ActionButton action={() => moveLessonInModule(m.id, l.id, 1)} variant="ghost" size="sm" className="px-1.5" title="Descer" disabled={li === ml.length - 1}>
                      <ArrowDown className="size-3.5" />
                    </ActionButton>
                    <ActionButton
                      action={() => toggleLessonFlag(l.id, 'is_published', !l.is_published)}
                      variant="ghost"
                      size="sm"
                      className="hidden px-1.5 sm:inline-flex"
                      title={l.is_published ? 'Ocultar' : 'Publicar'}
                    >
                      {l.is_published ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                    </ActionButton>
                    <ActionButton action={() => removeLessonFromModule(m.id, l.id)} success="Aula removida do módulo" variant="ghost" size="sm" className="px-1.5 hover:text-danger" title="Tirar do módulo (continua no banco de aulas)">
                      <X className="size-4" />
                    </ActionButton>
                  </div>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-2 border-t border-line">
              <button type="button" onClick={() => setPicker(m)} className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-brand transition hover:bg-brand-soft">
                <Folder className="size-4" /> Adicionar aulas
              </button>
              <button type="button" onClick={() => setLessonModal({ moduleId: m.id })} className="flex items-center justify-center gap-2 border-l border-line py-3 text-sm font-semibold text-ink-2 transition hover:bg-surface-2">
                <Plus className="size-4" /> Criar aula nova
              </button>
            </div>
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

      <Modal open={Boolean(lessonModal)} onClose={() => setLessonModal(null)} title={lessonModal?.lesson ? 'Editar aula' : 'Nova aula (entra no banco de aulas e neste módulo)'} size="lg">
        {lessonModal && (
          <LessonForm lesson={lessonModal.lesson} folders={folders} addToModule={lessonModal.lesson ? undefined : lessonModal.moduleId} onDone={() => setLessonModal(null)} />
        )}
      </Modal>

      <Modal open={Boolean(picker)} onClose={() => setPicker(null)} title={picker ? `Adicionar aulas em “${picker.title}”` : ''}>
        {picker && (
          <LessonPicker
            folders={folders}
            bank={bank}
            already={new Set(lessons.filter((l) => l.module_id === picker.id).map((l) => l.id))}
            onAdd={(ids) => addLessonsToModule(picker.id, ids)}
            onDone={() => setPicker(null)}
          />
        )}
      </Modal>
    </div>
  );
}

/** Escolhe aulas do banco navegando pelas pastas (como no MemberClass). */
function LessonPicker({
  folders,
  bank,
  already,
  onAdd,
  onDone,
}: {
  folders: LessonFolder[];
  bank: PickerLesson[];
  already: Set<string>;
  onAdd: (ids: string[]) => Promise<{ error?: string }>;
  onDone: () => void;
}) {
  const [folder, setFolder] = useState<string | null | undefined>(undefined); // undefined = lista de pastas
  const [chosen, setChosen] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [pending, start] = useTransition();
  const known = new Set(folders.map((f) => f.id));
  const available = bank.filter((l) => !already.has(l.id));
  const inFolder = (id: string | null) => available.filter((l) => (id === null ? !l.folder_id || !known.has(l.folder_id) : l.folder_id === id));
  const term = q.trim().toLowerCase();
  const shown = term ? available.filter((l) => l.title.toLowerCase().includes(term)) : folder === undefined ? [] : inFolder(folder);
  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const name = folder === null ? 'Sem pasta' : folders.find((f) => f.id === folder)?.name;

  return (
    <div className="space-y-3">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar aula pelo nome…" />
      {!term && folder !== undefined && (
        <button type="button" onClick={() => setFolder(undefined)} className="flex items-center gap-1.5 text-xs font-semibold text-brand">
          <ArrowLeft className="size-3.5" /> Pastas <span className="text-muted">/ {name}</span>
        </button>
      )}
      <div className="scrollbar-thin max-h-[50dvh] space-y-1.5 overflow-y-auto">
        {!term && folder === undefined ? (
          <>
            {folders.map((f) => (
              <FolderRow key={f.id} name={f.name} count={inFolder(f.id).length} onClick={() => setFolder(f.id)} />
            ))}
            {inFolder(null).length > 0 && <FolderRow name="Sem pasta" count={inFolder(null).length} onClick={() => setFolder(null)} inbox />}
            {!available.length && <p className="py-8 text-center text-sm text-muted">Todas as aulas do banco já estão neste módulo. Crie aulas novas em Admin → Aulas.</p>}
          </>
        ) : shown.length ? (
          shown.map((l) => {
            const on = chosen.includes(l.id);
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => toggle(l.id)}
                className={cn('flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition', on ? 'border-brand bg-brand/15' : 'border-line bg-surface-2 hover:border-brand/50')}
              >
                <span className="relative aspect-video w-16 shrink-0 overflow-hidden rounded-md bg-surface-3">
                  {l.thumbnail_url || l.youtube_id ? (
                    <Img src={l.thumbnail_url || youtubeThumb(l.youtube_id)} className="size-full object-cover" />
                  ) : (
                    <FileText className="absolute inset-0 m-auto size-4 text-danger" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{l.title}</span>
                <span className={cn('grid size-6 shrink-0 place-items-center rounded-full', on ? 'bg-brand text-white' : 'border border-line-strong text-transparent')}>
                  {on ? <span className="text-[10px] font-bold">{chosen.indexOf(l.id) + 1}</span> : <Check className="size-3.5" />}
                </span>
              </button>
            );
          })
        ) : (
          <p className="py-8 text-center text-sm text-muted">Nenhuma aula disponível aqui.</p>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
        <span className="text-xs text-muted">{chosen.length ? `${chosen.length} selecionada(s), entram nesta ordem` : 'Toque nas aulas para selecionar'}</span>
        <Button
          disabled={!chosen.length || pending}
          onClick={() =>
            start(async () => {
              const r = await onAdd(chosen);
              if (r.error) return void toast.error(r.error);
              toast(`${chosen.length} aula(s) adicionada(s)`);
              onDone();
            })
          }
        >
          {pending && <Spinner />} Adicionar {chosen.length || ''}
        </Button>
      </div>
    </div>
  );
}

function FolderRow({ name, count, onClick, inbox }: { name: string; count: number; onClick: () => void; inbox?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-left transition hover:border-brand/50">
      <span className="flex min-w-0 items-center gap-3">
        {inbox ? <Inbox className="size-4 shrink-0 text-muted" /> : <Folder className="size-4 shrink-0 text-brand" />}
        <span className="truncate text-sm font-bold text-ink">{name}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2 text-[11px] text-muted tabular-nums">
        {count} disponíve{count === 1 ? 'l' : 'is'} <ChevronRight className="size-4" />
      </span>
    </button>
  );
}
