import { ChevronLeft, Lock, MessageCircle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CoverCard, CoverFallback } from '@/components/course/course-card';
import { Badge, Img, ProgressBar } from '@/components/ui';
import { whatsappLink } from '@/lib/contact';
import { getCourseTree, getMyProgress } from '@/lib/data';
import { getCatalogData } from '@/lib/db';
import { canAccessCourse, getSettings, requireViewer } from '@/lib/session';

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
  const [{ course, modules, lessons }, progress, settings, catalog] = await Promise.all([
    getCourseTree(id, viewer),
    getMyProgress(viewer.userId),
    getSettings(),
    getCatalogData(),
  ]);
  if (!course) notFound();

  const locked = !canAccessCourse(viewer, course, settings.restrict_to_student_list);
  const done = new Set(progress.filter((p) => p.completed).map((p) => p.lesson_id));
  const uniqueIds = [...new Set(lessons.map((l) => l.id))];
  const completedCount = uniqueIds.filter((x) => done.has(x)).length;
  const pct = uniqueIds.length ? Math.round((completedCount / uniqueIds.length) * 100) : 0;
  // Bloqueado: mostra os módulos publicados (com cadeado) para o aluno ver o que tem no curso
  const cards = (locked ? catalog.modules.filter((m) => m.course_id === course.id && m.is_published) : modules)
    .map((m) => {
      const ml = locked
        ? new Set(catalog.lessons.filter((l) => l.module_id === m.id && l.is_published).map((l) => l.id))
        : new Set(lessons.filter((l) => l.module_id === m.id).map((l) => l.id));
      const mdone = [...ml].filter((x) => done.has(x)).length;
      return {
        ...m,
        count: ml.size,
        pct: !locked && ml.size ? Math.round((mdone / ml.size) * 100) : 0,
        free: locked && lessons.some((l) => l.module_id === m.id),
      };
    })
    .filter((m) => m.count > 0);

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
              {!locked && lessons.length > 0 && (
                <div className="mt-5">
                  <div className="w-full sm:max-w-sm">
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

      {/* Módulos/playlists como capas, igual à tela inicial */}
      {cards.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 xl:grid-cols-5">
          {cards.map((m, i) => (
            <CoverCard
              key={m.id}
              href={`/cursos/${course.id}/m/${m.id}`}
              title={m.title}
              cover={m.cover_url || course.cover_url}
              seed={m.id}
              locked={locked && !m.free}
              progress={m.pct}
              priority={i < 6}
              caption={`${m.count} aula${m.count === 1 ? '' : 's'}${m.pct ? ` · ${m.pct}%` : ''}`}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">As aulas deste curso serão publicadas em breve.</p>
      )}
    </div>
  );
}
