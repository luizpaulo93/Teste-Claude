'use client';

import { CheckCircle2, ChevronLeft, ChevronRight, Circle, FileText, Heart, Download, PlayCircle, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { VideoPlayer } from '@/components/player/video-player';
import { toast } from '@/components/toast';
import { buttonClass, Card } from '@/components/ui';
import { Modal, Spinner } from '@/components/ui-client';
import { getFileUrl } from '@/lib/storage/client';
import { createClient } from '@/lib/supabase/client';
import type { Lesson, LessonMaterial } from '@/lib/types';
import { cn, youtubeThumb } from '@/lib/utils';

interface Props {
  lesson: Lesson;
  materials: LessonMaterial[];
  modules: { id: string; title: string }[];
  lessons: { id: string; title: string; duration: string; module_id: string; thumb: string }[];
  completedIds: string[];
  initialCompleted: boolean;
  initialFavorite: boolean;
  startAt: number;
  prevId: string | null;
  nextId: string | null;
  userId: string;
  watermark: string;
  comments?: ReactNode;
}

export function LessonView(p: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [completed, setCompleted] = useState(p.initialCompleted);
  const [favorite, setFavorite] = useState(p.initialFavorite);
  const [doneSet, setDoneSet] = useState(() => new Set(p.completedIds));
  const [pdf, setPdf] = useState<{ title: string; url: string } | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const savingRef = useRef(false);

  // Grava direto no Supabase (sem passar por função serverless) — escala com muitos alunos simultâneos.
  const saveProgress = useCallback(
    async (patch: { completed?: boolean; position_sec?: number; duration_sec?: number }) => {
      const { error } = await supabase.from('lesson_progress').upsert(
        { user_id: p.userId, lesson_id: p.lesson.id, course_id: p.lesson.course_id, updated_at: new Date().toISOString(), ...patch },
        { onConflict: 'user_id,lesson_id' },
      );
      return error;
    },
    [supabase, p.userId, p.lesson.id, p.lesson.course_id],
  );

  const onProgress = useCallback(
    (pos: number, dur: number) => {
      if (savingRef.current) return;
      savingRef.current = true;
      saveProgress({ position_sec: pos, duration_sec: dur }).finally(() => (savingRef.current = false));
    },
    [saveProgress],
  );

  const setDone = async (value: boolean) => {
    setCompleted(value);
    setDoneSet((s) => {
      const n = new Set(s);
      if (value) n.add(p.lesson.id);
      else n.delete(p.lesson.id);
      return n;
    });
    const err = await saveProgress({ completed: value });
    if (err) {
      setCompleted(!value);
      toast.error('Não foi possível salvar. Tente de novo.');
    } else if (value) toast('Aula marcada como concluída');
  };

  const toggleFav = async () => {
    const next = !favorite;
    setFavorite(next);
    const { error } = next
      ? await supabase.from('favorites').upsert({ user_id: p.userId, lesson_id: p.lesson.id })
      : await supabase.from('favorites').delete().eq('user_id', p.userId).eq('lesson_id', p.lesson.id);
    if (error) {
      setFavorite(!next);
      toast.error('Não foi possível atualizar favoritos.');
    } else toast(next ? 'Adicionada aos favoritos' : 'Removida dos favoritos');
  };

  const openMaterial = async (m: LessonMaterial, download = false) => {
    setOpeningId(m.id);
    let signedUrl = '';
    try {
      signedUrl = await getFileUrl(m.file_path, download ? m.title : undefined);
    } catch {
      setOpeningId(null);
      return toast.error('Arquivo indisponível.');
    }
    setOpeningId(null);
    if (download) window.location.href = signedUrl;
    else if (window.matchMedia('(max-width: 768px)').matches) window.open(signedUrl, '_blank', 'noopener');
    else setPdf({ title: m.title, url: signedUrl });
  };

  const goNext = p.nextId ? () => router.push(`/aula/${p.nextId}`) : undefined;
  const hasVideo = p.lesson.youtube_id.length >= 6;
  const total = p.lessons.length;
  const doneCount = p.lessons.filter((l) => doneSet.has(l.id)).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-5">
        <div className="-mx-4 sm:mx-0">
          {hasVideo ? (
            <VideoPlayer
              key={p.lesson.id}
              videoId={p.lesson.youtube_id}
              poster={p.lesson.thumbnail_url || youtubeThumb(p.lesson.youtube_id)}
              watermark={p.watermark}
              startAt={p.startAt}
              onProgress={onProgress}
              onEnded={() => !completed && setDone(true)}
              onNext={goNext}
            />
          ) : (
            <div className="grid aspect-video place-items-center bg-surface-2 sm:rounded-2xl">
              <div className="text-center">
                <FileText className="mx-auto size-10 text-brand" />
                <p className="mt-2 text-sm text-muted">Esta aula é composta por materiais de leitura.</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">{p.lesson.title}</h1>
            {p.lesson.duration && <p className="mt-1 text-sm text-muted">{p.lesson.duration}</p>}
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={toggleFav}
              aria-pressed={favorite}
              className={buttonClass('secondary', 'md', favorite ? 'text-danger' : '')}
            >
              <Heart className={cn('size-4', favorite && 'fill-current')} />
              <span className="hidden sm:inline">{favorite ? 'Favorita' : 'Favoritar'}</span>
            </button>
            <button
              type="button"
              onClick={() => setDone(!completed)}
              className={buttonClass(completed ? 'secondary' : 'primary', 'md', completed ? 'text-success' : '')}
            >
              {completed ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}
              {completed ? 'Concluída' : 'Marcar como concluída'}
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          {p.prevId && (
            <Link href={`/aula/${p.prevId}`} className={buttonClass('outline', 'md', 'flex-1 sm:flex-none')}>
              <ChevronLeft className="size-4" /> Anterior
            </Link>
          )}
          {p.nextId && (
            <Link href={`/aula/${p.nextId}`} className={buttonClass('outline', 'md', 'ml-auto flex-1 sm:flex-none')}>
              Próxima <ChevronRight className="size-4" />
            </Link>
          )}
        </div>

        {p.materials.length > 0 && (
          <Card className="p-4 sm:p-5">
            <p className="mb-3 text-sm font-bold text-ink">Materiais da aula</p>
            <ul className="space-y-2">
              {p.materials.map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/60 p-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-danger/10 text-danger">
                    <FileText className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{m.title}</p>
                    {m.size_label && <p className="text-xs text-muted">{m.size_label}</p>}
                  </div>
                  <button type="button" onClick={() => openMaterial(m)} className={buttonClass('secondary', 'sm')} disabled={openingId === m.id}>
                    {openingId === m.id ? <Spinner /> : <ExternalLink className="size-3.5" />} Abrir
                  </button>
                  <button type="button" aria-label="Baixar" onClick={() => openMaterial(m, true)} className={buttonClass('ghost', 'sm', 'px-2')}>
                    <Download className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {p.lesson.description && (
          <Card className="p-4 sm:p-5">
            <p className="mb-2 text-sm font-bold text-ink">Sobre a aula</p>
            <p className="text-sm leading-relaxed whitespace-pre-line text-ink-2">{linkify(p.lesson.description)}</p>
          </Card>
        )}

        {p.comments}
      </div>

      {/* Lista de aulas */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Card className="overflow-hidden">
          <div className="border-b border-line p-4">
            <p className="text-sm font-bold text-ink">Conteúdo do curso</p>
            <p className="text-xs text-muted">
              {doneCount}/{total} concluídas
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-gradient-to-r from-brand to-accent transition-all" style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }} />
            </div>
          </div>
          <div className="scrollbar-thin max-h-[60vh] overflow-y-auto lg:max-h-[calc(100dvh-220px)]">
            {p.modules.map((m) => {
              const items = p.lessons.filter((l) => l.module_id === m.id);
              if (!items.length) return null;
              return (
                <div key={m.id}>
                  <p className="sticky top-0 z-10 border-b border-line bg-surface-2/95 px-4 py-2 text-[11px] font-bold tracking-wide text-muted uppercase backdrop-blur">
                    {m.title}
                  </p>
                  {items.map((l) => {
                    const active = l.id === p.lesson.id;
                    const isDone = doneSet.has(l.id);
                    return (
                      <Link
                        key={l.id}
                        href={`/aula/${l.id}`}
                        scroll={false}
                        className={cn(
                          'flex items-center gap-3 border-l-2 px-3 py-2.5 text-sm transition',
                          active ? 'border-brand bg-brand-soft font-semibold text-ink' : 'border-transparent text-ink-2 hover:bg-surface-2',
                        )}
                      >
                        <span className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-lg bg-surface-3">
                          {l.thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={l.thumb} alt="" loading="lazy" className="size-full object-cover" />
                          ) : (
                            <FileText className="absolute inset-0 m-auto size-4 text-muted" />
                          )}
                          {active && (
                            <span className="absolute inset-0 grid place-items-center bg-black/45">
                              <PlayCircle className="size-5 text-white" />
                            </span>
                          )}
                          {isDone && !active && (
                            <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-success text-white">
                              <CheckCircle2 className="size-3" />
                            </span>
                          )}
                          {l.duration && <span className="absolute right-1 bottom-1 rounded bg-black/75 px-1 text-[9px] font-semibold text-white tabular-nums">{l.duration}</span>}
                        </span>
                        <span className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-snug">{l.title}</span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </Card>
      </aside>

      <Modal open={Boolean(pdf)} onClose={() => setPdf(null)} title={pdf?.title} size="full">
        {pdf && <iframe src={`${pdf.url}#toolbar=0&navpanes=0`} title={pdf.title} className="h-[75dvh] w-full rounded-xl bg-white" />}
      </Modal>
    </div>
  );
}

function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand underline-offset-2 hover:underline">
        {part}
      </a>
    ) : (
      part
    ),
  );
}
