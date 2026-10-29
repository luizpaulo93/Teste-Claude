import { CheckCircle2, ChevronLeft, FileText, Lock, MessageCircle, PlayCircle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Img } from '@/components/ui';
import { whatsappLink } from '@/lib/contact';
import { getCourseTree, getMyProgress } from '@/lib/data';
import { getCatalogData } from '@/lib/db';
import { canAccessCourse, getSettings, requireViewer } from '@/lib/session';
import { cn, youtubeThumb } from '@/lib/utils';

type Params = Promise<{ id: string; moduleId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { moduleId } = await params;
  const { modules } = await getCatalogData();
  return { title: modules.find((m) => m.id === moduleId)?.title ?? 'Módulo' };
}

export default async function ModulePage({ params }: { params: Params }) {
  const { id, moduleId } = await params;
  if (!/^[\w-]{1,64}$/.test(id) || !/^[\w-]{1,64}$/.test(moduleId)) notFound();
  const viewer = await requireViewer();
  const [{ course, lessons }, progress, settings, catalog] = await Promise.all([
    getCourseTree(id, viewer),
    getMyProgress(viewer.userId),
    getSettings(),
    getCatalogData(),
  ]);
  if (!course) notFound();
  const mod = catalog.modules.find((m) => m.id === moduleId && m.course_id === course.id && (m.is_published || viewer.isAdmin));
  if (!mod) notFound();

  const locked = !canAccessCourse(viewer, course, settings.restrict_to_student_list);
  const done = new Set(progress.filter((p) => p.completed).map((p) => p.lesson_id));
  const ml = lessons.filter((l) => l.module_id === mod.id);
  // Bloqueado: aulas aparecem com cadeado (só o nome)
  const lockedTitles = locked
    ? [...new Map(catalog.lessons.filter((l) => l.module_id === mod.id && l.is_published && !ml.some((x) => x.id === l.id)).map((l) => [l.id, l.title])).values()]
    : [];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href={`/cursos/${course.id}`} className="inline-flex max-w-full items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ChevronLeft className="size-4 shrink-0" /> <span className="truncate">{course.title}</span>
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{mod.title}</h1>
        {mod.description && <p className="text-sm whitespace-pre-line text-muted">{mod.description}</p>}
      </div>

      {locked && (
        <a
          href={whatsappLink(`Olá! Quero liberar meu acesso ao curso "${course.title}". Meu e-mail: ${viewer.email}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-5 py-3.5 text-sm font-bold text-white shadow-card transition hover:brightness-105 sm:inline-flex"
        >
          <MessageCircle className="size-5" /> Liberar acesso pelo WhatsApp
        </a>
      )}

      <ol className="overflow-hidden rounded-2xl border border-line bg-surface">
        {ml.map((l, li) => {
          const isDone = done.has(l.id);
          return (
            <li key={l.id} className="cv-auto border-b border-line last:border-b-0">
              <Link href={`/aula/${l.id}?c=${course.id}`} className="flex items-center gap-3 px-3.5 py-2.5 transition hover:bg-surface-2 sm:px-4">
                <span className="w-6 shrink-0 text-xs font-semibold text-muted tabular-nums">{String(li + 1).padStart(2, '0')}</span>
                <span className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-lg bg-surface-3 sm:w-24">
                  {l.thumbnail_url || l.youtube_id ? (
                    <Img src={l.thumbnail_url || youtubeThumb(l.youtube_id)} className="size-full object-cover" />
                  ) : (
                    <FileText className="absolute inset-0 m-auto size-5 text-danger" />
                  )}
                  <span className={cn('absolute right-1 bottom-1 grid size-5 place-items-center rounded-full', isDone ? 'bg-success text-white' : 'bg-black/60 text-white')}>
                    {isDone ? <CheckCircle2 className="size-3.5" /> : l.youtube_id ? <PlayCircle className="size-3.5" /> : <FileText className="size-3" />}
                  </span>
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{l.title}</span>
                {l.is_free && locked && <Badge tone="success">Grátis</Badge>}
                {l.duration && <span className="shrink-0 text-xs text-muted tabular-nums">{l.duration}</span>}
              </Link>
            </li>
          );
        })}
        {lockedTitles.map((t, i) => (
          <li key={`l${i}`} className="flex items-center gap-3 border-b border-line px-3.5 py-3 text-sm text-muted last:border-b-0 sm:px-4">
            <span className="w-6 shrink-0 text-xs tabular-nums">{String(ml.length + i + 1).padStart(2, '0')}</span>
            <span className="min-w-0 flex-1 truncate">{t}</span>
            <Lock className="size-3.5 shrink-0" />
          </li>
        ))}
      </ol>
      {!ml.length && !lockedTitles.length && <p className="text-sm text-muted">Nenhuma aula neste módulo ainda.</p>}
    </div>
  );
}
