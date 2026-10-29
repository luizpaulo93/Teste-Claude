import { ChevronRight, Lock, Play, Radio } from 'lucide-react';
import Link from 'next/link';
import { CourseCard, CoverFallback } from '@/components/course/course-card';
import { Rail } from '@/components/home/rail';
import { LiveCard } from '@/components/live/live-card';
import { Card, Img } from '@/components/ui';
import { EVENT_COLORS, eventColor } from '@/lib/calendar';
import { courseProgress, getCatalog, getMyProgress, getUpcomingEvents, visibleLessons } from '@/lib/data';
import { visibleLives } from '@/lib/live';
import { canAccessCourse, getSettings, requireViewer } from '@/lib/session';
import type { LiveSession } from '@/lib/types';
import { cn, firstName, formatDate, youtubeThumb } from '@/lib/utils';

export default async function HomePage() {
  const viewer = await requireViewer();
  const [settings, { courses, lessonCount, courseLessons }, progress, events, lives] = await Promise.all([
    getSettings(),
    getCatalog(),
    getMyProgress(viewer.userId),
    getUpcomingEvents(5),
    viewer.isMember ? visibleLives(viewer, ['live', 'scheduled']) : Promise.resolve([] as LiveSession[]),
  ]);

  // Última aula em andamento (a mais recente que ainda não terminou)
  const recent = progress.filter((p) => !p.completed).slice(0, 10);
  const ids = new Set(recent.map((r) => r.lesson_id));
  const playable = recent.length ? await visibleLessons(viewer, (l) => ids.has(l.id)) : [];
  const resume = recent.map((r) => ({ p: r, lesson: playable.find((l) => l.id === r.lesson_id) })).find((x) => x.lesson);

  const restrict = settings.restrict_to_student_list;
  // Curso gratuito só aparece para quem não está em nenhuma turma
  const shown = courses.filter((c) => !(c.is_free && viewer.classGroup && !viewer.isAdmin));
  const mine = shown.filter((c) => canAccessCourse(viewer, c, restrict));
  const others = shown.filter((c) => !canAccessCourse(viewer, c, restrict));
  const liveNow = lives.filter((l) => l.status === 'live');
  const soon = lives.filter((l) => l.status === 'scheduled').sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, 10);
  const name = firstName(viewer.profile.full_name);

  const resumeCourse = resume?.lesson ? courses.find((c) => c.id === resume.lesson!.course_id) : undefined;
  const resumePct =
    resume && resume.p.duration_sec > 0 ? Math.min(98, Math.max(4, Math.round((resume.p.position_sec / resume.p.duration_sec) * 100))) : 0;

  return (
    <div className="mx-auto max-w-[1360px] space-y-9 pt-2 sm:pt-6">
      {/* Cabeçalho limpo */}
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div className="max-w-2xl space-y-2.5">
          {name && <p className="text-xs font-bold tracking-[0.2em] text-brand uppercase">Olá, {name}</p>}
          <h1 className="text-2xl leading-[1.12] font-extrabold tracking-tight text-balance text-ink sm:text-4xl md:text-[2.75rem]">{settings.hero_title}</h1>
          {settings.hero_subtitle && <p className="max-w-lg text-sm font-medium text-ink-2 sm:text-base">{settings.hero_subtitle}</p>}
        </div>
      </section>

      {/* Eventos do curso (topo, compacto) */}
      {events.length > 0 && (
        <section className="rail -mx-4 flex gap-2.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {events.map((e) => {
            const color = EVENT_COLORS[eventColor(e.category, e.color)] ?? EVENT_COLORS.blue;
            return (
              <Link
                key={e.id}
                href={`/calendario?d=${e.start_date}`}
                className="flex w-[78%] shrink-0 items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3 transition hover:bg-surface-2 sm:w-72"
              >
                <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl text-center leading-none', color.circle)}>
                  <span className="text-[15px] font-extrabold tabular-nums">{Number(e.start_date.slice(8, 10))}</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{e.title}</span>
                  <span className="block text-[11px] text-muted uppercase">
                    {formatDate(e.start_date)}
                    {e.end_date !== e.start_date && ` – ${formatDate(e.end_date)}`}
                  </span>
                </span>
              </Link>
            );
          })}
        </section>
      )}

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

      {/* 1. Ao vivo agora */}
      {liveNow.map((l) => (
        <section key={l.id} className="space-y-2.5">
          <h2 className="flex items-center gap-2 text-xs font-extrabold tracking-wider text-rose-500 uppercase sm:text-sm">
            <span className="size-2.5 animate-pulse rounded-full bg-rose-500" /> Transmissão ao vivo agora
          </h2>
          <Link
            href={`/ao-vivo/${l.id}`}
            className="group flex items-center justify-between gap-4 rounded-2xl border border-rose-500/50 bg-gradient-to-r from-rose-600/20 via-surface to-surface p-4 shadow-card transition hover:border-rose-500 hover:from-rose-600/30 sm:p-5"
          >
            <span className="flex min-w-0 items-center gap-3.5">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-rose-600 text-white shadow-lg transition-transform group-hover:scale-105">
                <Radio className="size-5 animate-pulse" />
              </span>
              <span className="min-w-0 space-y-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-white uppercase">Ao vivo</span>
                  <span className="truncate text-[11px] font-semibold text-ink-2">Entre na transmissão com 1 clique</span>
                </span>
                <span className="block truncate text-sm font-extrabold text-ink sm:text-base">{l.title}</span>
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white transition-colors group-hover:bg-rose-500">
              <span className="hidden sm:inline">Entrar na live</span> <ChevronRight className="size-4" />
            </span>
          </Link>
        </section>
      ))}

      {/* 2. Continuar assistindo */}
      {resume?.lesson && (
        <section className="space-y-2.5">
          <h2 className="flex items-center gap-2 text-xs font-bold tracking-wider text-brand uppercase sm:text-sm">
            <Play className="size-3.5 fill-current" /> Continuar assistindo
          </h2>
          <Link
            href={`/aula/${resume.lesson.id}`}
            className="group flex items-center gap-3.5 rounded-2xl border border-brand/25 bg-surface p-3 shadow-card transition hover:border-brand/70 hover:bg-surface-2 sm:max-w-2xl sm:gap-4 sm:p-3.5"
          >
            <span className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-xl bg-surface-3 sm:w-40">
              {resume.lesson.thumbnail_url || resume.lesson.youtube_id ? (
                <Img src={resume.lesson.thumbnail_url || youtubeThumb(resume.lesson.youtube_id)} loading="eager" className="size-full object-cover" />
              ) : (
                <CoverFallback title="" seed={resume.lesson.id} />
              )}
              <span className="absolute inset-0 grid place-items-center bg-black/30">
                <span className="grid size-9 place-items-center rounded-full bg-brand text-white transition-transform group-hover:scale-110">
                  <Play className="ml-0.5 size-4 fill-current" />
                </span>
              </span>
            </span>
            <span className="min-w-0 flex-1 space-y-1.5">
              {resumeCourse && <span className="block truncate text-[10px] font-bold tracking-wider text-brand uppercase">{resumeCourse.title}</span>}
              <span className="block truncate text-sm font-extrabold text-ink sm:text-base">{resume.lesson.title}</span>
              {resumePct > 0 && (
                <span className="flex items-center gap-3">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                    <span className="block h-full rounded-full bg-brand" style={{ width: `${resumePct}%` }} />
                  </span>
                  <span className="shrink-0 text-[10px] font-bold text-muted tabular-nums">{resumePct}%</span>
                </span>
              )}
            </span>
            <ChevronRight className="size-5 shrink-0 text-brand transition-transform group-hover:translate-x-0.5" />
          </Link>
        </section>
      )}

      {/* 3. Cursos liberados */}
      {mine.length > 0 && (
        <Rail
          title={viewer.isMember ? 'Cursos disponíveis' : 'Conteúdo gratuito'}
          subtitle={viewer.classGroup ? `Liberados para ${viewer.classGroup.name}` : viewer.isAdmin ? 'Todos os cursos (você é administrador)' : undefined}
          action={
            <Link href="/cursos" className="text-xs font-semibold text-brand">
              Ver tudo
            </Link>
          }
        >
          {mine.map((course, i) => {
            const total = lessonCount.get(course.id) ?? 0;
            return (
              <div key={course.id} className="w-[46%] shrink-0 sm:w-[210px] lg:w-[240px]">
                <CourseCard course={course} locked={false} lessons={total} progress={courseProgress(courseLessons.get(course.id), progress)} priority={i < 5} />
              </div>
            );
          })}
        </Rail>
      )}

      {/* Próximos aulões */}
      {soon.length > 0 && (
        <Rail
          title="Próximos aulões ao vivo"
          action={
            <Link href="/ao-vivo" className="text-xs font-semibold text-brand">
              Ver todos
            </Link>
          }
        >
          {soon.map((l) => (
            <LiveCard key={l.id} live={l} className="w-[40%] shrink-0 sm:w-[170px]" />
          ))}
        </Rail>
      )}

      {others.length > 0 && (
        <Rail title={mine.length ? 'Outros cursos' : 'Cursos'} subtitle="Conteúdo exclusivo para alunos matriculados">
          {others.map((course) => (
            <div key={course.id} className="w-[46%] shrink-0 sm:w-[210px] lg:w-[240px]">
              <CourseCard course={course} locked lessons={lessonCount.get(course.id) ?? 0} progress={0} />
            </div>
          ))}
        </Rail>
      )}

      {!courses.length && <p className="text-sm text-muted">Nenhum curso publicado ainda.</p>}

    </div>
  );
}
