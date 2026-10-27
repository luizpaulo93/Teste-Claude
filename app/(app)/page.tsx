import { CalendarDays, Lock, Play } from 'lucide-react';
import Link from 'next/link';
import { CourseCard, CoverFallback } from '@/components/course/course-card';
import { HeroCarousel, type HeroSlide } from '@/components/home/hero-carousel';
import { LiveCard } from '@/components/live/live-card';
import { Rail } from '@/components/home/rail';
import { Card, Img, ProgressBar } from '@/components/ui';
import { courseProgress, getCatalog, getMyProgress, getUpcomingEvents, visibleLessons, type LessonSummary } from '@/lib/data';
import { canAccessCourse, getSettings, requireViewer } from '@/lib/session';
import { visibleLives } from '@/lib/live';
import type { Course, LiveSession } from '@/lib/types';
import { firstName, formatDate, youtubeThumb } from '@/lib/utils';

export default async function HomePage() {
  const viewer = await requireViewer();
  const [settings, { courses, lessonCount }, progress, events] = await Promise.all([
    getSettings(),
    getCatalog(),
    getMyProgress(viewer.userId),
    getUpcomingEvents(4),
  ]);

  const recent = progress.filter((p) => !p.completed).slice(0, 10);
  let continueLessons: LessonSummary[] = [];
  if (recent.length) {
    const ids = new Set(recent.map((r) => r.lesson_id));
    const list = await visibleLessons(viewer, (l) => ids.has(l.id));
    const byId = new Map(list.map((l) => [l.id, l]));
    continueLessons = recent.map((r) => byId.get(r.lesson_id)).filter(Boolean) as LessonSummary[];
  }

  let lives: LiveSession[] = [];
  if (viewer.isMember) {
    lives = (await visibleLives(viewer, ['live', 'scheduled']))
      .sort((a, b) => Number(b.status === 'live') - Number(a.status === 'live') || a.starts_at.localeCompare(b.starts_at))
      .slice(0, 12);
  }

  const restrict = settings.restrict_to_student_list;
  const isLocked = (c: Course) => !canAccessCourse(viewer, c, restrict);
  const name = firstName(viewer.profile.full_name);

  // Destaques do carrossel: cursos marcados como destaque (ou a mensagem de boas-vindas)
  const featured = courses.filter((c) => c.featured).slice(0, 5);
  const slides: HeroSlide[] = featured.map((c) => {
    const locked = isLocked(c);
    const resume = !locked && continueLessons.find((l) => l.course_id === c.id);
    return {
      id: c.id,
      eyebrow: c.category || (name ? `Olá, ${name}` : 'Destaque'),
      title: c.title,
      subtitle: c.subtitle || c.description,
      image: c.banner_url || c.cover_url,
      href: resume ? `/aula/${resume.id}` : `/cursos/${c.id}`,
      cta: locked ? 'Conteúdo exclusivo' : resume ? 'Continuar assistindo' : 'Assistir agora',
      secondaryHref: `/cursos/${c.id}`,
      locked,
      resume: Boolean(resume),
    };
  });
  if (!slides.length) {
    slides.push({
      id: 'welcome',
      eyebrow: name ? `Olá, ${name}` : 'Bem-vindo',
      title: settings.hero_title,
      subtitle: settings.hero_subtitle,
      image: settings.hero_bg_url,
      href: continueLessons[0] ? `/aula/${continueLessons[0].id}` : '/cursos',
      cta: continueLessons[0] ? 'Continuar de onde parei' : settings.hero_cta,
      resume: Boolean(continueLessons[0]),
    });
  }

  // Fileiras por categoria (como seções de streaming); cursos liberados primeiro
  const groups = new Map<string, Course[]>();
  [...courses]
    .sort((a, b) => Number(isLocked(a)) - Number(isLocked(b)))
    .forEach((c) => {
      const key = c.category || 'Cursos';
      groups.set(key, [...(groups.get(key) ?? []), c]);
    });

  const totalDone = progress.filter((p) => p.completed).length;
  const totalLessons = [...lessonCount.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-9 sm:space-y-11">
      <HeroCarousel slides={slides} />

      {!viewer.isMember && (
        <Card className="-mt-4 flex flex-col gap-4 border-warning/30 bg-warning/5 p-5 sm:flex-row sm:items-center">
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

      {lives.length > 0 && (
        <Rail
          title={lives[0].status === 'live' ? '🔴 Ao vivo agora' : 'Próximos aulões ao vivo'}
          action={
            <Link href="/ao-vivo" className="text-xs font-semibold text-brand">
              Ver todos
            </Link>
          }
        >
          {lives.map((l) => (
            <LiveCard key={l.id} live={l} className="w-[40%] shrink-0 sm:w-[190px]" />
          ))}
        </Rail>
      )}

      {continueLessons.length > 0 && (
        <Rail title="Continuar assistindo">
          {continueLessons.map((l) => {
            const p = recent.find((r) => r.lesson_id === l.id);
            return (
              <Link key={l.id} href={`/aula/${l.id}`} className="group w-[72%] shrink-0 sm:w-[300px]">
                <div className="relative aspect-video overflow-hidden rounded-xl border border-line bg-surface-2 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-glow">
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
        </Rail>
      )}

      {[...groups.entries()].map(([title, list], gi) => (
        <Rail
          key={title}
          title={title}
          action={
            gi === 0 ? (
              <Link href="/cursos" className="text-xs font-semibold text-brand">
                Ver tudo
              </Link>
            ) : undefined
          }
        >
          {list.map((course, i) => {
            const locked = isLocked(course);
            const total = lessonCount.get(course.id) ?? 0;
            return (
              <div key={course.id} className="w-[44%] shrink-0 sm:w-[210px] lg:w-[230px]">
                <CourseCard course={course} locked={locked} lessons={total} progress={locked ? 0 : courseProgress(course.id, total, progress)} priority={gi === 0 && i < 5} />
              </div>
            );
          })}
        </Rail>
      ))}

      {!courses.length && <p className="text-sm text-muted">Nenhum curso publicado ainda.</p>}

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-semibold text-muted">Seu progresso</p>
          <p className="mt-2 text-4xl font-extrabold tracking-tight text-ink tabular-nums">{totalDone}</p>
          <p className="text-sm text-muted">aulas concluídas</p>
          <ProgressBar className="mt-4" value={Math.min(100, (totalDone / Math.max(1, totalLessons)) * 100)} />
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
