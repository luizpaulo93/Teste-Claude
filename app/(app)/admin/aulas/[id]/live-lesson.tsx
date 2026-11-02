'use client';

import { FileText, Lock, MessageSquare, Save, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PdfDrop } from '@/components/admin/uploads';
import { VideoPlayer } from '@/components/player/video-player';
import { toast } from '@/components/toast';
import { Avatar, Button, Card, Field, Input } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import { getFileUrl } from '@/lib/storage/client';
import type { LessonMaterial, LiveMessage } from '@/lib/types';
import { cn, formatDateTime, youtubeThumb } from '@/lib/utils';
import { saveLiveLesson } from '../../live-actions';

const hm = (iso: string) => new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso));

export function LiveLessonEditor({
  lesson,
  startsAt,
  messages,
}: {
  lesson: { id: string; title: string; youtube_id: string; materials: LessonMaterial[] };
  startsAt: string | null;
  messages: LiveMessage[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(lesson.title);
  const [mats, setMats] = useState<LessonMaterial[]>(lesson.materials ?? []);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const dirty = title !== lesson.title || JSON.stringify(mats) !== JSON.stringify(lesson.materials ?? []);

  async function save() {
    setBusy(true);
    const r = await saveLiveLesson(lesson.id, { title, materials: mats }).catch(() => ({ error: 'Não foi possível salvar.' }));
    setBusy(false);
    if (r.error) return toast.error(r.error);
    toast('Aula salva');
    router.refresh();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        <div className="-mx-4 sm:mx-0">
          {lesson.youtube_id ? (
            <VideoPlayer videoId={lesson.youtube_id} title={title} poster={youtubeThumb(lesson.youtube_id)} />
          ) : (
            <div className="grid aspect-video place-items-center bg-surface-2 text-sm text-muted sm:rounded-2xl">Sem vídeo</div>
          )}
        </div>
        <Card className="space-y-4 p-4">
          <Field label="Nome da aula">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} aria-label="Nome da aula" />
          </Field>
          <Field label="Link do YouTube">
            <div className="relative">
              <Input value={lesson.youtube_id ? `https://youtu.be/${lesson.youtube_id}` : ''} disabled readOnly className="pr-9" />
              <Lock className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
            </div>
          </Field>
          {startsAt && <p className="text-xs text-muted">Live de {formatDateTime(startsAt)}</p>}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-ink-2">PDFs da aula</p>
            {mats.map((m) => (
              <div key={m.id} className="flex items-center gap-1.5 rounded-xl border border-line pr-2">
                <button
                  type="button"
                  onClick={() => getFileUrl(m.file_path, m.title).then((u) => window.open(u, '_blank'), () => toast.error('Arquivo indisponível.'))}
                  aria-label="Abrir PDF"
                  title="Abrir PDF"
                  className="grid size-9 shrink-0 place-items-center rounded-l-xl text-danger hover:bg-surface-2"
                >
                  <FileText className="size-4" />
                </button>
                <Input
                  value={m.title}
                  onChange={(e) => setMats((l) => l.map((x) => (x.id === m.id ? { ...x, title: e.target.value } : x)))}
                  className="h-9 flex-1 border-0 bg-transparent px-1"
                  aria-label="Nome do PDF"
                />
                <span className="shrink-0 text-[10px] text-muted">{m.size_label}</span>
                <button type="button" onClick={() => setMats((l) => l.filter((x) => x.id !== m.id))} aria-label="Tirar PDF" className="text-muted hover:text-danger">
                  <X className="size-4" />
                </button>
              </div>
            ))}
            {!mats.length && (
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <FileText className="size-3.5" /> Nenhum PDF nesta aula.
              </p>
            )}
            <PdfDrop
              folder="lives/pdfs"
              multiple
              label="Subir PDF"
              onBatchStart={() => setUploading(true)}
              onBatchDone={() => setUploading(false)}
              onUploaded={(r) => setMats((l) => [...l, { id: crypto.randomUUID().slice(0, 12), title: r.title, file_path: r.path, size_label: r.size }])}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={save} disabled={busy || uploading || !dirty}>
              {busy ? <Spinner /> : <Save className="size-4" />} Salvar alterações
            </Button>
          </div>
        </Card>
      </div>

      <Card className="flex max-h-[80dvh] flex-col overflow-hidden lg:sticky lg:top-6 lg:self-start">
        <div className="border-b border-line px-4 py-3">
          <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
            <MessageSquare className="size-4 text-brand" /> Chat da live
          </p>
          <p className="text-xs text-muted">
            {messages.length} mensage{messages.length === 1 ? 'm' : 'ns'}
          </p>
        </div>
        <ul className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((m) => (
            <li key={m.id} className="flex gap-2.5">
              <Avatar name={m.author_name} src={m.author_avatar} size={28} />
              <div className="min-w-0">
                <p className="text-[11px] text-muted">
                  <span className={cn('font-semibold', m.author_role === 'admin' ? 'text-brand' : 'text-ink-2')}>{m.author_name}</span> · {hm(m.created_at)}
                </p>
                <p className="text-sm break-words whitespace-pre-line text-ink">{m.text}</p>
              </div>
            </li>
          ))}
          {!messages.length && <li className="py-6 text-center text-sm text-muted">Ninguém escreveu no chat desta live.</li>}
        </ul>
      </Card>
    </div>
  );
}
