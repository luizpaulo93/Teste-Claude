'use client';

import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Circle, Download, ExternalLink, FileText, Heart, ListVideo, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { VideoPlayer } from '@/components/player/video-player';
import { toast } from '@/components/toast';
import { buttonClass } from '@/components/ui';
import { Modal, Spinner } from '@/components/ui-client';
import { getFileUrl } from '@/lib/storage/client';
import { saveProgressServer, setFavoriteServer } from './actions';
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
  const [completed, setCompleted] = useState(p.initialCompleted);
  const [favorite, setFavorite] = useState(p.initialFavorite);
  const [doneSet, setDoneSet] = useState(() => new Set(p.completedIds));
  const [pdf, setPdf] = useState<{ title: string; url: string } | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const savingRef = useRef(false);
  const [listOpen, setListOpen] = useState(false);
  // Modo cinema: vídeo na largura toda (lembrado neste navegador)
  const [theater, setTheater] = useState(false);
  useEffect(() => {
    try {
      setTheater(localStorage.getItem('vertice_theater') === '1');
    } catch {
      /* sem armazenamento */
    }
  }, []);
  const toggleTheater = () =>
    setTheater((v) => {
      try {
        localStorage.setItem('vertice_theater', v ? '0' : '1');
      } catch {
        /* sem armazenamento */
      }
      return !v;
    });

  const saveProgress = useCallback(
    async (patch: { completed?: boolean; position_sec?: number; duration_sec?: number }) => {
      const r = await saveProgressServer(p.lesson.id, p.lesson.course_id, patch).catch(() => ({ error: 'falha' }));
      return r.error ?? null;
    },
    [p.lesson.id, p.lesson.course_id],
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
    const error = Boolean((await setFavoriteServer(p.lesson.id, next).catch(() => ({ error: 'falha' }))).error);
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

  const q = p.lesson.course_id ? `?c=${p.lesson.course_id}` : '';
  const goNext = p.nextId ? () => router.push(`/aula/${p.nextId}${q}`) : undefined;
  const hasVideo = p.lesson.youtube_id.length >= 6;
  const total = p.lessons.length;
  const doneCount = p.lessons.filter((l) => doneSet.has(l.id)).length;

  const pos = p.lessons.findIndex((l) => l.id === p.lesson.id);
  const currentModule = p.modules.find((m) => m.id === p.lesson.module_id);

  return (
    <div className={cn('mx-auto space-y-4', theater ? 'max-w-none' : 'max-w-5xl')}>
      <div className="-mx-4 sm:mx-0">
        {hasVideo ? (
          <VideoPlayer
            key={p.lesson.id}
            videoId={p.lesson.youtube_id}
            title={p.lesson.title}
            completed={completed}
            onToggleComplete={() => setDone(!completed)}
            theater={theater}
            onToggleTheater={toggleTheater}
            poster={p.lesson.thumbnail_url || youtubeThumb(p.lesson.youtube_id)}
            watermark={p.watermark}
            startAt={p.startAt}
            onProgress={onProgress}
            onEnded={() => !completed && setDone(true)}
            onNext={goNext}
          />
        ) : (
          <div className="relative grid aspect-video place-items-center overflow-hidden bg-surface-2 sm:rounded-2xl">
            {p.lesson.thumbnail_url && (
              // Foto escolhida pelo professor para indicar o tipo de material
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.lesson.thumbnail_url} alt="" className="absolute inset-0 size-full object-cover" />
            )}
            {p.lesson.thumbnail_url && <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />}
            <div className={cn('relative text-center', p.lesson.thumbnail_url && 'self-end pb-6 text-white')}>
              {!p.lesson.thumbnail_url && <FileText className="mx-auto size-10 text-brand" />}
              <p className={cn('mt-2 text-sm', p.lesson.thumbnail_url ? 'font-semibold text-white/90' : 'text-muted')}>Material em PDF</p>
              {p.materials[0] && (
                <button type="button" onClick={() => openMaterial(p.materials[0])} className={buttonClass('primary', 'md', 'mt-3')}>
                  {openingId === p.materials[0].id ? <Spinner /> : <FileText className="size-4" />} Abrir PDF
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Título + ações (enxuto) */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg leading-snug font-extrabold tracking-tight text-ink sm:text-xl">{p.lesson.title}</h1>
          {currentModule && <p className="mt-0.5 truncate text-xs text-muted">{currentModule.title}</p>}
        </div>
        <button
          type="button"
          onClick={toggleFav}
          aria-pressed={favorite}
          aria-label={favorite ? 'Remover dos favoritos' : 'Favoritar'}
          title={favorite ? 'Remover dos favoritos' : 'Favoritar'}
          className={cn('grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-surface transition hover:bg-surface-2', favorite ? 'text-danger' : 'text-ink-2')}
        >
          <Heart className={cn('size-4', favorite && 'fill-current')} />
        </button>
        <button
          type="button"
          onClick={() => setDone(!completed)}
          title={completed ? 'Concluída' : 'Marcar como concluída'}
          className={cn(
            'flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition',
            completed ? 'border border-success/40 bg-success/10 text-success' : 'bg-brand text-white hover:bg-brand-strong',
          )}
        >
          {completed ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}
          <span className="hidden sm:inline">{completed ? 'Concluída' : 'Concluir'}</span>
        </button>
      </div>

      {/* Aulas do curso: menu suspenso logo abaixo do vídeo */}
      {total > 0 && (
        <div className="flex items-stretch gap-2">
          <Link
            href={p.prevId ? `/aula/${p.prevId}${q}` : '#'}
            aria-disabled={!p.prevId}
            aria-label="Aula anterior"
            className={cn('grid w-11 shrink-0 place-items-center rounded-xl border border-line bg-surface text-ink-2 transition hover:bg-surface-2', !p.prevId && 'pointer-events-none opacity-40')}
          >
            <ChevronLeft className="size-5" />
          </Link>
          <div className="relative min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setListOpen((v) => !v)}
              aria-expanded={listOpen}
              className="flex h-full w-full items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-left transition hover:bg-surface-2"
            >
              <ListVideo className="size-4 shrink-0 text-brand" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-ink">Aulas do curso</span>
                <span className="block text-[11px] text-muted tabular-nums">
                  {pos + 1} de {total} · {doneCount} concluídas
                </span>
              </span>
              <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-surface-3 sm:block">
                <span className="block h-full rounded-full bg-brand" style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }} />
              </span>
              <ChevronDown className={cn('size-4 shrink-0 text-muted transition-transform', listOpen && 'rotate-180')} />
            </button>
            {listOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setListOpen(false)} />
                <div className="scrollbar-thin absolute inset-x-0 top-full z-40 mt-2 max-h-[60dvh] overflow-y-auto rounded-2xl border border-line bg-surface shadow-2xl">
                  {p.modules.map((m) => {
                    const items = p.lessons.filter((l) => l.module_id === m.id);
                    if (!items.length) return null;
                    return (
                      <div key={m.id}>
                        <p className="sticky top-0 z-10 border-b border-line bg-surface-2/95 px-4 py-2 text-[11px] font-bold tracking-wide text-muted uppercase backdrop-blur">{m.title}</p>
                        {items.map((l) => {
                          const active = l.id === p.lesson.id;
                          const isDone = doneSet.has(l.id);
                          return (
                            <Link
                              key={l.id}
                              href={`/aula/${l.id}${q}`}
                              scroll={false}
                              onClick={() => setListOpen(false)}
                              className={cn('flex items-center gap-3 border-l-2 px-3 py-2 text-sm transition', active ? 'border-brand bg-brand-soft font-semibold text-ink' : 'border-transparent text-ink-2 hover:bg-surface-2')}
                            >
                              <span className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-md bg-surface-3">
                                {l.thumb ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={l.thumb} alt="" loading="lazy" className="size-full object-cover" />
                                ) : (
                                  <FileText className="absolute inset-0 m-auto size-4 text-danger" />
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
                              </span>
                              <span className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-snug">{l.title}</span>
                              {l.duration && <span className="shrink-0 text-[11px] text-muted tabular-nums">{l.duration}</span>}
                            </Link>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <Link
            href={p.nextId ? `/aula/${p.nextId}${q}` : '#'}
            aria-disabled={!p.nextId}
            aria-label="Próxima aula"
            className={cn('grid w-11 shrink-0 place-items-center rounded-xl border border-line bg-surface text-ink-2 transition hover:bg-surface-2', !p.nextId && 'pointer-events-none opacity-40')}
          >
            <ChevronRight className="size-5" />
          </Link>
        </div>
      )}

      {p.materials.length > 0 && (
        <ul className="space-y-2">
          {p.materials.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-danger/10 text-danger">
                <FileText className="size-4" />
              </span>
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{m.title}</p>
              <button type="button" onClick={() => openMaterial(m)} className={buttonClass('secondary', 'sm')} disabled={openingId === m.id}>
                {openingId === m.id ? <Spinner /> : <ExternalLink className="size-3.5" />} Abrir
              </button>
              <button type="button" aria-label="Baixar" onClick={() => openMaterial(m, true)} className={buttonClass('ghost', 'sm', 'px-2')}>
                <Download className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {p.lesson.description && (
        <details className="group rounded-xl border border-line bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-ink-2 [&::-webkit-details-marker]:hidden">
            Descrição <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <p className="px-4 pb-4 text-sm leading-relaxed whitespace-pre-line text-ink-2">{linkify(p.lesson.description)}</p>
        </details>
      )}

      {p.comments}

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
