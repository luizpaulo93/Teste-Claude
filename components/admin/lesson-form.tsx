'use client';

import { ArrowDown, ArrowDownAZ, ArrowUp, FileText, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { saveLesson } from '@/app/(app)/admin/content-actions';
import { ActionForm } from '@/components/admin/action-form';
import { ImageUpload, PdfDrop } from '@/components/admin/uploads';
import { Button, Field, Input, Textarea } from '@/components/ui';
import { SubmitButton, Switch } from '@/components/ui-client';
import type { Lesson, LessonFolder } from '@/lib/types';

interface MaterialDraft {
  id?: string;
  title: string;
  file_path: string;
  size_label: string;
}

export const byTitle = (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title, 'pt-BR', { numeric: true, sensitivity: 'base' });

/** Formulário de aula do banco de aulas: vídeo (opcional), foto de capa, PDFs e pasta. */
export function LessonForm({
  lesson,
  folders,
  folderId,
  addToModule,
  onDone,
}: {
  lesson?: Pick<Lesson, 'id' | 'title' | 'description' | 'youtube_id' | 'duration' | 'thumbnail_url' | 'is_free' | 'is_published' | 'materials' | 'folder_id'>;
  folders: LessonFolder[];
  folderId?: string | null;
  /** Aula nova já entra neste módulo */
  addToModule?: string;
  onDone: () => void;
}) {
  const [mats, setMats] = useState<MaterialDraft[]>((lesson?.materials ?? []).map((m) => ({ id: m.id, title: m.title, file_path: m.file_path, size_label: m.size_label })));
  const pending = useRef<MaterialDraft[]>([]);
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
      {lesson && <input type="hidden" name="id" value={lesson.id} />}
      {addToModule && <input type="hidden" name="add_to_module" value={addToModule} />}
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
      <Field label="Pasta (banco de aulas)">
        <select name="folder_id" defaultValue={lesson?.folder_id ?? folderId ?? ''} className="h-11 w-full rounded-xl border border-line-strong bg-bg-elev px-3 text-sm text-ink">
          <option value="">Sem pasta</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-ink-2">Foto de capa</span>
        <p className="text-[11px] text-muted">
          Com vídeo: substitui a capa do YouTube na plataforma. Só PDF: indica o tipo de material (ex.: “Lista de exercícios”, “Resumo”).
        </p>
        <ImageUpload name="thumbnail_url" defaultValue={lesson?.thumbnail_url} folder="lessons" aspect="aspect-video max-w-xs" maxSize={1280} />
      </div>
      <Field label="Descrição / links">
        <Textarea name="description" defaultValue={lesson?.description} maxLength={4000} rows={3} />
      </Field>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-ink-2">Materiais em PDF ({mats.length})</span>
          {mats.length > 1 && (
            <button type="button" onClick={() => setMats((l) => [...l].sort(byTitle))} className="flex items-center gap-1 text-xs font-semibold text-brand">
              <ArrowDownAZ className="size-3.5" /> Ordem alfabética
            </button>
          )}
        </div>
        {mats.map((m, i) => (
          <div key={m.file_path} className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 p-2">
            <span className="w-5 text-center text-[11px] font-bold text-muted tabular-nums">{i + 1}</span>
            <FileText className="size-4 shrink-0 text-danger" />
            <input
              value={m.title}
              onChange={(e) => setMats((list) => list.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
              maxLength={160}
              aria-label="Nome do material"
            />
            <span className="hidden text-[11px] text-muted sm:inline">{m.size_label}</span>
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
        {mats.length < 30 && (
          <PdfDrop
            multiple
            folder="lessons"
            label="Adicionar PDFs (pode selecionar vários)"
            onUploaded={(r) => pending.current.push({ title: r.title, file_path: r.path, size_label: r.size })}
            onBatchDone={() => {
              // Lote novo entra em ordem alfabética; depois é só reorganizar com as setas
              const batch = [...pending.current].sort(byTitle);
              pending.current = [];
              setMats((list) => [...list, ...batch]);
            }}
          />
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Switch name="is_published" defaultChecked={lesson?.is_published ?? true} label="Publicada" />
        <Switch name="is_free" defaultChecked={lesson?.is_free} label="Aula grátis" description="Liberada mesmo sem acesso ao curso" />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <SubmitButton>{lesson ? 'Salvar aula' : 'Criar aula'}</SubmitButton>
      </div>
    </ActionForm>
  );
}
