import { ArrowRight, CalendarDays, Lock, Play, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { CourseCard, CoverFallback } from '@/components/course/course-card';
import { Badge, Card, Img, LinkButton, ProgressBar } from '@/components/ui';
import { courseProgress, getCatalog, getMyProgress, getUpcomingEvents, LESSON_LIST_COLUMNS, type LessonSummary } from '@/lib/data';
import { canAccessCourse, getSettings, requireViewer } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { firstName, formatDate, youtubeThumb } from '@/lib/utils';

export default async function HomePage() {
  const viewer = await requireViewer();
  const [settings, { courses, lessonCount }, progress, events] = await Promise.all([
    getSettings(),
    getCatalog(),
    getMyProgress(viewer.userId),
    getUpcomingEvents(4),
  ]);

  const recent = progress.filter((p) => !p.completed).slice(0, 8);
  let continueLessons: LessonSummary[] = [];
  if (recent.length) {
    const supabase = await createClient();
    const { data } = await supabase.from('lessons').select(LESSON_LIST_COLUMNS).in('id', recent.map((r) => r.lesson_id));
    const byId = new Map((data ?? []).map((l: LessonSummary) => [l.id, l]));
    continueLessons = recent.map((r) => byId.get(r.lesson_id)).filter(Boolean) as LessonSummary[];
  }

  const featured = courses.find((c) => c.featured) ?? null;
  const restrict = settings.restrict_to_student_list;
  const withAccess = courses.map((c) => ({ course: c, locked: !canAccessCourse(viewer, c, restrict) }));
  const mine = withAccess.filter((c) => !c.locked);
  const locked = withAccess.filter((c) => c.locked);
  const totalDone = progress.filter((p) => p.completed).length;
  const heroBg = featured?.banner_url || settings.hero_bg_url;

  return (
    <div className="space-y-10 sm:space-y-12">
      {/* Hero */}
      <section className="relative -mx-4 overflow-hidden sm:mx-0 sm:rounded-3xl">
        <div className="relative min-h-[300px] sm:min-h-[340px] lg:min-h-[380px]">
          {heroBg ? (
            <Img src={heroBg} loading="eager" fetchPriority="high" className="absolute inset-0 size-full object-cover" />
          ) : (
            <div className="hero-fallback absolute inset-0">
              <div className="hero-grid absolute inset-0" />
            </div>
          )}
          {heroBg && <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/10" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="relative flex h-full min-h-[inherit] flex-col justify-end p-5 sm:p-8 lg:p-10">
            <div className="max-w-xl animate-slide-up">
              <Badge tone="brand" className="mb-3 bg-white/10 text-white backdrop-blur">
                <Sparkles className="size-3" /> Olá, {firstName(viewer.profile.full_name) || 'aluno'}
              </Badge>
              <h1 className="text-3xl leading-[1.1] font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
                {featured ? featured.title : settings.hero_title}
              </h1>
              <p className="mt-3 line-clamp-2 text-sm text-white/75 sm:text-base">
                {featured ? featured.subtitle || featured.description : settings.hero_subtitle}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {continueLessons[0] ? (
                  <LinkButton href={`/aula/${continueLessons[0].id}`} size="lg">
                    <Play className="size-4 fill-current" /> Continuar de onde parei
                  </LinkButton>
                ) : (
                  <LinkButton href={featured ? `/cursos/${featured.id}` : '/cursos'} size="lg">
                    {settings.hero_cta} <ArrowRight className="size-4" />
                  </LinkButton>
                )}
                <LinkButton href="/cursos" size="lg" variant="outline" className="border-white/25 text-white hover:bg-white/10">
                  Ver todos os cursos
                </LinkButton>
              </div>
            </div>
          </div>
        </div>
      </section>

      {!viewer.isMember && (
        <Card className="flex flex-col gap-4 border-warning/30 bg-warning/5 p-5 sm:flex-row sm:items-center">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-warning/15 text-warning">
            <Lock className="size-5" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-ink">Seu acesso ainda não foi liberado</p>
            <p className="text-sm text-muted">
              Você pode assistir ao conteúdo gratuito. Se já é aluno, peça para a coordenação liberar o e-mail{' '}
              <strong className="text-ink-2">{viewer.email}</strong>.
            </p>
          </div>
        </Card>
      )}

      {/* Continuar assistindo */}
      {continueLessons.length > 0 && (
        <section>
          <SectionTitle title="Continuar assistindo" />
          <div className="rail -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {continueLessons.map((l) => {
              const p = recent.find((r) => r.lesson_id === l.id);
              return (
                <Link key={l.id} href={`/aula/${l.id}`} className="group w-[260px] shrink-0 sm:w-[300px]">
                  <div className="relative aspect-video overflow-hidden rounded-2xl border border-line bg-surface-2">
                    {l.thumbnail_url || l.youtube_id ? (
                      <Img src={l.thumbnail_url || youtubeThumb(l.youtube_id)} className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <CoverFallback title="" seed={l.id} />
                    )}
                    <div className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="grid size-12 place-items-center rounded-full bg-white/90 text-black">
                        <Play className="ml-0.5 size-5 fill-current" />
                      </span>
                    </div>
                    {p && p.position_sec > 0 && p.duration_sec > 0 && (
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
                        <div className="h-full bg-brand" style={{ width: `${Math.min(95, Math.max(5, (p.position_sec / p.duration_sec) * 100))}%` }} />
                      </div>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-1 text-sm font-semibold text-ink">{l.title}</p>
                  {l.duration && <p className="text-xs text-muted">{l.duration}</p>}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Meus cursos */}
      <section>
        <SectionTitle title={mine.length ? 'Meus cursos' : 'Cursos'} href="/cursos" />
        {mine.length ? (
          <CourseRail
            items={mine.map(({ course }) => ({
              course,
              locked: false,
              progress: courseProgress(course.id, lessonCount.get(course.id) ?? 0, progress),
              lessons: lessonCount.get(course.id) ?? 0,
            }))}
          />
        ) : (
          <p className="text-sm text-muted">Nenhum curso disponível ainda.</p>
        )}
      </section>

      {locked.length > 0 && (
        <section>
          <SectionTitle title="Conheça também" />
          <CourseRail items={locked.map(({ course }) => ({ course, locked: true, progress: 0, lessons: 0 }))} />
        </section>
      )}

      {/* Resumo + agenda */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <p className="text-xs font-semibold text-muted">Seu progresso</p>
          <p className="mt-2 text-4xl font-extrabold tracking-tight text-ink tabular-nums">{totalDone}</p>
          <p className="text-sm text-muted">aulas concluídas</p>
          <ProgressBar className="mt-4" value={Math.min(100, (totalDone / Math.max(1, [...lessonCount.values()].reduce((a, b) => a + b, 0))) * 100)} />
        </Card>
        <Card className="p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-bold text-ink">
              <CalendarDays className="size-4 text-brand" /> Próximos eventos
            </p>
            <Link href="/calendario" className="text-xs font-semibold text-brand">
              Ver calendário
            </Link>
          </div>
          {events.length ? (
            <ul className="divide-y divide-line">
              {events.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-20 shrink-0 text-xs font-bold text-brand uppercase">{formatDate(e.start_date)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{e.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nada agendado por enquanto.</p>
          )}
        </Card>
      </section>
    </div>
  );
}

function SectionTitle({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <h2 className="text-lg font-extrabold tracking-tight text-ink sm:text-xl">{title}</h2>
      {href && (
        <Link href={href} className="flex items-center gap-1 text-xs font-semibold text-brand">
          Ver tudo <ArrowRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}

function CourseRail({ items }: { items: Parameters<typeof CourseCard>[0][] }) {
  return (
    <div className="rail -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:gap-4 sm:px-0">
      {items.map((it, i) => (
        <div key={it.course.id} className="w-[42%] shrink-0 sm:w-[200px] lg:w-[210px]">
          <CourseCard {...it} priority={i < 4} />
        </div>
      ))}
    </div>
  );
}
