'use client';

import { ArrowDown, ArrowDownAZ, ArrowUp, Eye, EyeOff, FileText, Folder, FolderInput, FolderPlus, Inbox, Pencil, Plus, Trash2, UploadCloud, Video } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { byTitle, LessonForm } from '@/components/admin/lesson-form';
import { ImageUpload, PdfDrop } from '@/components/admin/uploads';
import { toast } from '@/components/toast';
import { Badge, Button, Card, EmptyState, Img, Input } from '@/components/ui';
import { ActionButton, Modal, Spinner } from '@/components/ui-client';
import type { Lesson, LessonFolder } from '@/lib/types';
import { cn, youtubeThumb } from '@/lib/utils';
import {
  createPdfLessons,
  deleteFolder,
  deleteLesson,
  moveFolder,
  moveLessonInFolder,
  moveLessonsToFolder,
  saveFolder,
  sortFolderAlphabetically,
  toggleLessonFlag,
} from '../content-actions';

export type BankLesson = Pick<
  Lesson,
  'id' | 'title' | 'description' | 'youtube_id' | 'duration' | 'thumbnail_url' | 'is_free' | 'is_published' | 'materials' | 'folder_id' | 'position'
> & { uses: number };

export function LessonBank({ folders, lessons, current }: { folders: LessonFolder[]; lessons: BankLesson[]; current: string | null }) {
  const router = useRouter();
  const [folderModal, setFolderModal] = useState<{ folder?: LessonFolder } | null>(null);
  const [lessonModal, setLessonModal] = useState<{ lesson?: BankLesson } | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  const inFolder = (id: string | null) => lessons.filter((l) => (l.folder_id ?? null) === id || (id === null && l.folder_id && !folders.some((f) => f.id === l.folder_id)));
  const list = inFolder(current);
  const currentName = current ? (folders.find((f) => f.id === current)?.name ?? 'Pasta') : 'Sem pasta';
  const hrefFor = (id: string | null) => `/admin/aulas?f=${id ?? 'none'}`;

  const toggleSel = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* Pastas */}
      <Card className="h-fit overflow-hidden lg:sticky lg:top-6">
        <div className="flex items-center justify-between border-b border-line p-3">
          <p className="text-sm font-bold text-ink">Pastas</p>
          <Button size="sm" variant="secondary" onClick={() => setFolderModal({})}>
            <FolderPlus className="size-4" /> Nova pasta
          </Button>
        </div>
        <ul className="scrollbar-thin max-h-[60vh] overflow-y-auto p-1.5">
          {folders.map((f, i) => {
            const count = inFolder(f.id).length;
            const active = f.id === current;
            return (
              <li key={f.id} className={cn('group flex items-center gap-1 rounded-xl', active ? 'bg-brand-soft' : 'hover:bg-surface-2')}>
                <Link href={hrefFor(f.id)} scroll={false} className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2.5" onClick={() => setSelected(new Set())}>
                  <Folder className={cn('size-4 shrink-0', active ? 'fill-brand/20 text-brand' : 'text-muted')} />
                  <span className={cn('truncate text-sm', active ? 'font-bold text-ink' : 'text-ink-2')}>{f.name}</span>
                  <span className="ml-auto text-[11px] text-muted tabular-nums">{count}</span>
                </Link>
                <div className="hidden shrink-0 items-center pr-1 group-hover:flex">
                  <ActionButton action={() => moveFolder(f.id, -1)} variant="ghost" size="sm" className="px-1" title="Subir pasta" disabled={i === 0}>
                    <ArrowUp className="size-3.5" />
                  </ActionButton>
                  <ActionButton action={() => moveFolder(f.id, 1)} variant="ghost" size="sm" className="px-1" title="Descer pasta" disabled={i === folders.length - 1}>
                    <ArrowDown className="size-3.5" />
                  </ActionButton>
                </div>
              </li>
            );
          })}
          <li className={cn('flex items-center rounded-xl', current === null ? 'bg-brand-soft' : 'hover:bg-surface-2')}>
            <Link href={hrefFor(null)} scroll={false} className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2.5" onClick={() => setSelected(new Set())}>
              <Inbox className={cn('size-4 shrink-0', current === null ? 'text-brand' : 'text-muted')} />
              <span className={cn('truncate text-sm', current === null ? 'font-bold text-ink' : 'text-ink-2')}>Sem pasta</span>
              <span className="ml-auto text-[11px] text-muted tabular-nums">{inFolder(null).length}</span>
            </Link>
          </li>
        </ul>
      </Card>

      {/* Conteúdo da pasta */}
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto flex min-w-0 items-center gap-2 text-lg font-extrabold text-ink">
            {current ? <Folder className="size-5 text-brand" /> : <Inbox className="size-5 text-brand" />}
            <span className="truncate">{currentName}</span>
            <span className="text-sm font-medium text-muted">({list.length})</span>
          </h2>
          {current && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setFolderModal({ folder: folders.find((f) => f.id === current) })} title="Renomear pasta">
                <Pencil className="size-4" />
              </Button>
              <ActionButton
                action={async () => {
                  const r = await deleteFolder(current);
                  if (!r.error) router.push(hrefFor(null));
                  return r;
                }}
                confirm={`Excluir a pasta "${currentName}"? As aulas dela vão para "Sem pasta" (nada é apagado).`}
                success="Pasta excluída"
                variant="ghost"
                size="sm"
                className="hover:text-danger"
                title="Excluir pasta"
              >
                <Trash2 className="size-4" />
              </ActionButton>
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setLessonModal({})}>
            <Plus className="size-4" /> Criar aula
          </Button>
          <Button variant="secondary" onClick={() => setBatchOpen(true)}>
            <UploadCloud className="size-4" /> PDFs em lote
          </Button>
          {list.length > 1 && (
            <ActionButton action={() => sortFolderAlphabetically(current)} success="Pasta em ordem alfabética" variant="outline" confirm="Colocar as aulas desta pasta em ordem alfabética?">
              <ArrowDownAZ className="size-4" /> Ordem alfabética
            </ActionButton>
          )}
          {selected.size > 0 && (
            <Button variant="outline" onClick={() => setMoveOpen(true)}>
              <FolderInput className="size-4" /> Transferir ({selected.size})
            </Button>
          )}
        </div>

        {list.length ? (
          <Card className="divide-y divide-line overflow-hidden">
            {list.map((l, i) => {
              const pdfs = l.materials?.length ?? 0;
              return (
                <div key={l.id} className={cn('flex items-center gap-3 px-3 py-2.5 sm:px-4', selected.has(l.id) && 'bg-brand-soft/60')}>
                  <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleSel(l.id)} aria-label="Selecionar" className="size-4 shrink-0 accent-[#3b82f6]" />
                  <span className="w-5 shrink-0 text-center text-[11px] font-bold text-muted tabular-nums">{i + 1}</span>
                  <div className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-lg bg-surface-2 sm:w-24">
                    {l.thumbnail_url || l.youtube_id ? (
                      <Img src={l.thumbnail_url || youtubeThumb(l.youtube_id)} className="size-full object-cover" />
                    ) : (
                      <div className="grid size-full place-items-center text-danger">
                        <FileText className="size-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => setLessonModal({ lesson: l })} className="line-clamp-1 text-left text-sm font-semibold text-ink hover:text-brand">
                      {l.title}
                    </button>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {l.youtube_id && (
                        <Badge tone="brand">
                          <Video className="size-3" /> vídeo
                        </Badge>
                      )}
                      {pdfs > 0 && (
                        <Badge>
                          <FileText className="size-3" /> {pdfs} PDF
                        </Badge>
                      )}
                      {!l.is_published && <Badge>Oculta</Badge>}
                      {l.is_free && <Badge tone="success">Grátis</Badge>}
                      <span className="text-[11px] text-muted">{l.uses ? `em ${l.uses} módulo${l.uses > 1 ? 's' : ''}` : 'ainda não está em nenhum curso'}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <ActionButton action={() => moveLessonInFolder(l.id, -1)} variant="ghost" size="sm" className="px-1.5" title="Subir" disabled={i === 0}>
                      <ArrowUp className="size-3.5" />
                    </ActionButton>
                    <ActionButton action={() => moveLessonInFolder(l.id, 1)} variant="ghost" size="sm" className="px-1.5" title="Descer" disabled={i === list.length - 1}>
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
                    <ActionButton
                      action={() => deleteLesson(l.id)}
                      confirm={`Excluir a aula "${l.title}" de vez?${l.uses ? ` Ela sai de ${l.uses} módulo(s).` : ''}`}
                      success="Aula excluída"
                      variant="ghost"
                      size="sm"
                      className="px-1.5 hover:text-danger"
                      title="Excluir aula"
                    >
                      <Trash2 className="size-3.5" />
                    </ActionButton>
                  </div>
                </div>
              );
            })}
          </Card>
        ) : (
          <EmptyState
            icon={<Folder className="size-6" />}
            title="Pasta vazia"
            description="Crie uma aula (vídeo do YouTube e/ou PDFs) ou envie vários PDFs de uma vez: cada PDF vira uma aula, em ordem alfabética."
          />
        )}
      </div>

      {/* Pasta: criar/renomear */}
      <Modal open={Boolean(folderModal)} onClose={() => setFolderModal(null)} title={folderModal?.folder ? 'Renomear pasta' : 'Nova pasta'} size="sm">
        {folderModal && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const name = String(new FormData(e.currentTarget).get('name') ?? '');
              start(async () => {
                const r = await saveFolder(folderModal.folder?.id ?? '', name);
                if (r.error) return void toast.error(r.error);
                toast('Pasta salva');
                setFolderModal(null);
                if (!folderModal.folder && r.id) router.push(hrefFor(r.id));
              });
            }}
          >
            <Input name="name" defaultValue={folderModal.folder?.name} required maxLength={120} autoFocus placeholder="Ex.: Física — Cinemática" />
            <div className="flex justify-end">
              <Button type="submit" disabled={pending}>
                {pending && <Spinner />} Salvar
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Aula: criar/editar */}
      <Modal open={Boolean(lessonModal)} onClose={() => setLessonModal(null)} title={lessonModal?.lesson ? 'Editar aula' : `Nova aula em “${currentName}”`} size="lg">
        {lessonModal && <LessonForm lesson={lessonModal.lesson} folders={folders} folderId={current} onDone={() => setLessonModal(null)} />}
      </Modal>

      {/* PDFs em lote */}
      <Modal open={batchOpen} onClose={() => setBatchOpen(false)} title={`PDFs em lote em “${currentName}”`} size="lg">
        {batchOpen && <BatchPdf folderId={current} onDone={() => setBatchOpen(false)} />}
      </Modal>

      {/* Transferir */}
      <Modal open={moveOpen} onClose={() => setMoveOpen(false)} title={`Transferir ${selected.size} aula(s) para…`} size="sm">
        <div className="space-y-2">
          {[...folders.map((f) => ({ id: f.id as string | null, name: f.name })), { id: null, name: 'Sem pasta' }]
            .filter((f) => f.id !== current)
            .map((f) => (
              <button
                key={f.id ?? 'none'}
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await moveLessonsToFolder([...selected], f.id);
                    if (r.error) return void toast.error(r.error);
                    toast(`Transferidas para ${f.name}`);
                    setSelected(new Set());
                    setMoveOpen(false);
                  })
                }
                className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-left text-sm font-semibold text-ink hover:border-brand/50"
              >
                {f.id ? <Folder className="size-4 text-brand" /> : <Inbox className="size-4 text-muted" />} {f.name}
              </button>
            ))}
        </div>
      </Modal>
    </div>
  );
}

/** Vários PDFs → uma aula para cada, em ordem alfabética (depois reorganiza com as setas). */
function BatchPdf({ folderId, onDone }: { folderId: string | null; onDone: () => void }) {
  const [files, setFiles] = useState<{ title: string; file_path: string; size_label: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const sorted = [...files].sort(byTitle);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const cover = String(new FormData(e.currentTarget).get('cover') ?? '');
        start(async () => {
          const r = await createPdfLessons(folderId, sorted, cover);
          if (r.error) return void toast.error(r.error);
          toast(`${r.count} aula(s) criada(s) em ordem alfabética`);
          onDone();
        });
      }}
    >
      <p className="text-sm text-muted">
        Cada PDF vira uma aula (o nome do arquivo vira o título). Elas entram em <strong className="text-ink-2">ordem alfabética</strong>; depois é só usar as
        setas para deixar na ordem que você quiser.
      </p>
      <div>
        <PdfDrop
          onBatchStart={() => setUploading(true)}
          multiple
          folder="lessons"
          label="Escolher PDFs (pode selecionar vários)"
          onUploaded={(r) => setFiles((l) => [...l, { title: r.title, file_path: r.path, size_label: r.size }])}
          onBatchDone={() => setUploading(false)}
        />
      </div>
      {sorted.length > 0 && (
        <ul className="scrollbar-thin max-h-60 space-y-1.5 overflow-y-auto">
          {sorted.map((f, i) => (
            <li key={f.file_path} className="flex items-center gap-2 rounded-lg border border-line bg-surface-2/60 px-2.5 py-1.5 text-sm">
              <span className="w-6 text-[11px] font-bold text-muted tabular-nums">{i + 1}</span>
              <FileText className="size-4 shrink-0 text-danger" />
              <span className="min-w-0 flex-1 truncate text-ink">{f.title}</span>
              <span className="text-[11px] text-muted">{f.size_label}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-ink-2">Foto de capa para todas (opcional)</span>
        <p className="text-[11px] text-muted">Indica o tipo de material, por exemplo “Lista de exercícios”. Dá para trocar a foto de cada aula depois.</p>
        <ImageUpload name="cover" folder="lessons" aspect="aspect-video max-w-[240px]" maxSize={1280} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!files.length || pending || uploading}>
          {pending && <Spinner />} Criar {files.length || ''} aula{files.length === 1 ? '' : 's'}
        </Button>
      </div>
    </form>
  );
}
