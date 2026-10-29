import { CheckCircle2, ChevronLeft, FileText, Lock, Play, PlayCircle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CoverFallback } from '@/components/course/course-card';
import { Badge, Card, Img, LinkButton, ProgressBar } from '@/components/ui';
import { getCourseTree, getMyProgress } from '@/lib/data';
import { canAccessCourse, getSettings, requireViewer } from '@/lib/session';
import { cn, youtubeThumb } from '@/lib/utils';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const viewer = await requireViewer();
  const { course } = await getCourseTree(id, viewer);
  return { title: course?.title ?? 'Curso' };
}

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[\w-]{1,64}$/.test(id)) notFound();
  const viewer = await requireViewer();
  const [{ course, modules, lessons }, progress, settings] = await Promise.all([
    getCourseTree(id, viewer),
    getMyProgress(viewer.userId),
    getSettings(),
  ]);
  if (!course) notFound();

  const locked = !canAccessCourse(viewer, course, settings.restrict_to_student_list);
  const done = new Set(progress.filter((p) => p.completed).map((p) => p.lesson_id));
  const uniqueIds = [...new Set(lessons.map((l) => l.id))];
  const completedCount = uniqueIds.filter((x) => done.has(x)).length;
  const pct = uniqueIds.length ? Math.round((completedCount / uniqueIds.length) * 100) : 0;
  const inCourse = new Set(lessons.map((l) => l.id));
  const lastInCourse = progress.find((p) => inCourse.has(p.lesson_id));
  const firstPending = lessons.find((l) => !done.has(l.id));
  const resumeId = lastInCourse?.lesson_id ?? firstPending?.id ?? lessons[0]?.id;
  const visibleLessons = lessons; // RLS já esconde aulas bloqueadas (exceto grátis)

  return (
    <div className="space-y-8">
      <Link href="/cursos" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Cursos
      </Link>

      <section className="relative -mx-4 overflow-hidden sm:mx-0 sm:rounded-3xl">
        <div className="relative">
          <div className="absolute inset-0">
            {course.banner_url || course.cover_url ? (
              <Img src={course.banner_url || course.cover_url} loading="eager" className="size-full object-cover" />
            ) : (
              <CoverFallback title="" seed={course.id} />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/30 backdrop-blur-[1px]" />
          </div>
          <div className="relative grid gap-6 p-5 sm:grid-cols-[180px_1fr] sm:p-8 lg:grid-cols-[220px_1fr] lg:p-10">
            <div className="relative hidden aspect-[2/3] overflow-hidden rounded-2xl border border-white/10 shadow-2xl sm:block">
              {course.cover_url ? <Img src={course.cover_url} loading="eager" className="size-full object-cover" /> : <CoverFallback title={course.title} seed={course.id} />}
            </div>
            <div className="flex flex-col justify-end text-white">
              <div className="mb-3 flex flex-wrap gap-2">
                {course.category && <Badge className="bg-white/10 text-white">{course.category}</Badge>}
                {course.is_free && <Badge tone="success">Gratuito</Badge>}
                {locked && (
                  <Badge className="bg-white/10 text-white">
                    <Lock className="size-3" /> Exclusivo para alunos
                  </Badge>
                )}
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{course.title}</h1>
              {course.subtitle && <p className="mt-2 text-white/80">{course.subtitle}</p>}
              {course.description && <p className="mt-3 line-clamp-4 max-w-2xl text-sm whitespace-pre-line text-white/65">{course.description}</p>}
              {!locked && lessons.length > 0 && (
                <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
                  {resumeId && (
                    <LinkButton href={`/aula/${resumeId}?c=${course.id}`} size="lg">
                      <Play className="size-4 fill-current" /> {completedCount ? 'Continuar' : 'Começar curso'}
                    </LinkButton>
                  )}
                  <div className="w-full max-w-xs">
                    <div className="mb-1.5 flex justify-between text-xs text-white/70">
                      <span>
                        {completedCount} de {uniqueIds.length} aulas
                      </span>
                      <span className="font-bold text-white">{pct}%</span>
                    </div>
                    <ProgressBar value={pct} className="bg-white/15" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {locked && visibleLessons.length === 0 ? (
        <Card className="flex flex-col items-center p-10 text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Lock className="size-6" />
          </div>
          <p className="mt-4 text-lg font-bold text-ink">Este conteúdo é exclusivo</p>
          <p className="mt-1 max-w-md text-sm text-muted">
            Seu acesso a este curso ainda não está liberado. Fale com a coordenação para incluir o e-mail <strong>{viewer.email}</strong> na sua turma.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {modules.map((m, mi) => {
            const ml = visibleLessons.filter((l) => l.module_id === m.id);
            if (!ml.length) return null;
            const mdone = ml.filter((l) => done.has(l.id)).length;
            return (
              <details key={m.id} open={mi < 2} className="group overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
                <summary className="flex cursor-pointer list-none items-center gap-4 p-4 select-none sm:p-5 [&::-webkit-details-marker]:hidden">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-sm font-extrabold text-brand">{mi + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-ink">{m.title}</p>
                    <p className="text-xs text-muted">
                      {ml.length} aulas · {mdone} concluídas
                    </p>
                  </div>
                  <ChevronLeft className="size-5 -rotate-90 text-muted transition-transform group-open:rotate-90" />
                </summary>
                <ol className="border-t border-line">
                  {ml.map((l, li) => {
                    const isDone = done.has(l.id);
                    return (
                      <li key={`${m.id}-${l.id}`} className="cv-auto">
                        <Link href={`/aula/${l.id}?c=${course.id}`} className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-surface-2 sm:px-5">
                          <span className="w-6 text-xs font-semibold text-muted tabular-nums">{String(li + 1).padStart(2, '0')}</span>
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
                          {l.duration && <span className="text-xs text-muted tabular-nums">{l.duration}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </details>
            );
          })}
          {!visibleLessons.length && <p className="text-sm text-muted">As aulas deste curso serão publicadas em breve.</p>}
        </div>
      )}
    </div>
  );
}
