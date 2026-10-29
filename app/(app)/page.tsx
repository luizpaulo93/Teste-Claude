import { CalendarDays, CheckCircle2, ChevronRight, Lock, Play, Radio, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { CourseCard, CoverFallback } from '@/components/course/course-card';
import { Rail } from '@/components/home/rail';
import { LiveCard } from '@/components/live/live-card';
import { Card, Img } from '@/components/ui';
import { EVENT_COLORS } from '@/lib/calendar';
import { courseProgress, getCatalog, getMyProgress, getUpcomingEvents, visibleLessons } from '@/lib/data';
import { visibleLives } from '@/lib/live';
import { canAccessCourse, getSettings, requireViewer } from '@/lib/session';
import type { LiveSession } from '@/lib/types';
import { cn, firstName, formatDate, formatDateTime, youtubeThumb } from '@/lib/utils';

export default async function HomePage() {
  const viewer = await requireViewer();
  const [settings, { courses, lessonCount }, progress, events, lives] = await Promise.all([
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
  const mine = courses.filter((c) => canAccessCourse(viewer, c, restrict));
  const others = courses.filter((c) => !canAccessCourse(viewer, c, restrict));
  const liveNow = lives.filter((l) => l.status === 'live');
  const soon = lives.filter((l) => l.status === 'scheduled').sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, 10);
  const name = firstName(viewer.profile.full_name);

  // Progresso geral e por curso (só cursos liberados que têm aulas)
  const breakdown = mine
    .map((c) => {
      const total = lessonCount.get(c.id) ?? 0;
      const done = progress.filter((p) => p.course_id === c.id && p.completed).length;
      return { course: c, total, done: Math.min(done, total), pct: courseProgress(c.id, total, progress) };
    })
    .filter((x) => x.total > 0);
  const totalLessons = breakdown.reduce((a, b) => a + b.total, 0);
  const totalDone = breakdown.reduce((a, b) => a + b.done, 0);
  const overall = totalLessons ? Math.round((totalDone / totalLessons) * 100) : 0;
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
        <Link
          href="/calendario"
          className="group inline-flex shrink-0 items-center gap-3 self-start rounded-full border border-brand/30 bg-surface p-1.5 pr-4 shadow-card transition hover:border-brand/70 hover:bg-surface-2"
        >
          <span className="relative grid size-10 place-items-center rounded-full bg-gradient-to-tr from-blue-600 to-blue-300 text-white transition-transform group-hover:rotate-6 sm:size-11">
            <CalendarDays className="size-5" />
            <span className="absolute -top-0.5 -right-0.5 grid size-3.5 place-items-center rounded-full border-2 border-surface bg-emerald-400">
              <Sparkles className="size-2 text-black" />
            </span>
          </span>
          <span className="text-left">
            <span className="block text-xs font-extrabold text-ink">Calendário</span>
            <span className="block text-[10px] font-semibold text-brand">Semana & eventos</span>
          </span>
        </Link>
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
              <div key={course.id} className="w-[42%] shrink-0 sm:w-[180px] lg:w-[200px]">
                <CourseCard course={course} locked={false} lessons={total} progress={courseProgress(course.id, total, progress)} priority={i < 5} />
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
            <div key={course.id} className="w-[42%] shrink-0 sm:w-[180px] lg:w-[200px]">
              <CourseCard course={course} locked lessons={lessonCount.get(course.id) ?? 0} progress={0} />
            </div>
          ))}
        </Rail>
      )}

      {!courses.length && <p className="text-sm text-muted">Nenhum curso publicado ainda.</p>}

      {/* 4. Progresso + próximos eventos */}
      <section className="grid gap-5 lg:grid-cols-2">
        <Card className="min-w-0 space-y-4 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-extrabold tracking-wider text-ink uppercase">
                <CheckCircle2 className="size-4 text-brand" /> Seu progresso
              </h2>
              <p className="mt-0.5 text-xs text-muted">Aulas concluídas nos cursos liberados</p>
            </div>
            <span className="rounded-xl border border-brand/30 bg-brand/10 px-3 py-1.5 text-sm font-extrabold text-brand tabular-nums">{overall}%</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-ink-2">
              <span>Aulas concluídas</span>
              <span className="font-bold text-ink tabular-nums">
                {totalDone} / {totalLessons}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-gradient-to-r from-brand to-accent transition-[width] duration-500" style={{ width: `${overall}%` }} />
            </div>
          </div>
          {breakdown.length > 0 && (
            <div className="space-y-2 border-t border-line pt-3">
              <p className="text-[11px] font-bold tracking-wider text-muted uppercase">Por curso</p>
              <div className="scrollbar-thin max-h-52 space-y-2 overflow-y-auto pr-1">
                {breakdown.map(({ course, done, total, pct }) => (
                  <Link key={course.id} href={`/cursos/${course.id}`} className="group block space-y-1.5 rounded-xl border border-line bg-surface-2 p-2.5 transition-colors hover:bg-surface-3">
                    <span className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-bold text-ink transition-colors group-hover:text-brand">{course.title}</span>
                      <span className="shrink-0 text-[11px] font-semibold text-ink-2 tabular-nums">
                        {done}/{total} ({pct}%)
                      </span>
                    </span>
                    <span className="block h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <span className="block h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card className="min-w-0 space-y-3.5 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-extrabold tracking-wider text-ink uppercase">
                <CalendarDays className="size-4 text-brand" /> Próximos eventos
              </h2>
              <p className="mt-0.5 text-xs text-muted">Toque em um evento para abrir o calendário</p>
            </div>
            <Link href="/calendario" className="shrink-0 rounded-xl border border-brand/30 bg-brand/10 px-3.5 py-2 text-xs font-bold text-brand transition-colors hover:bg-brand hover:text-white">
              Ver calendário
            </Link>
          </div>
          {events.length ? (
            <div className="space-y-2">
              {events.map((e) => {
                const color = EVENT_COLORS[e.color] ?? EVENT_COLORS.blue;
                return (
                  <Link
                    key={e.id}
                    href={`/calendario?m=${e.start_date.slice(0, 7)}`}
                    className={cn('group flex items-center justify-between gap-3 rounded-xl border p-3 transition hover:brightness-110', color.chip)}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className={cn('size-2.5 shrink-0 rounded-full', color.dot)} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-ink">{e.title}</span>
                        {e.description && <span className="block truncate text-[11px] text-ink-2">{e.description}</span>}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold uppercase">
                      {formatDate(e.start_date)}
                      {e.end_date !== e.start_date && ` – ${formatDate(e.end_date)}`}
                      <ChevronRight className="size-4 opacity-60 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <Link href="/calendario" className="block rounded-xl border border-line bg-surface-2 p-6 text-center transition-colors hover:bg-surface-3">
              <span className="block text-xs font-bold text-ink">Nenhum evento próximo</span>
              <span className="mt-1 block text-[11px] font-semibold text-brand">Abrir o calendário completo</span>
            </Link>
          )}
          {soon[0] && (
            <p className="flex items-center gap-2 border-t border-line pt-3 text-xs text-muted">
              <Radio className="size-3.5 text-rose-500" /> Próximo aulão: <strong className="truncate text-ink-2">{soon[0].title}</strong> · {formatDateTime(soon[0].starts_at)}
            </p>
          )}
        </Card>
      </section>
    </div>
  );
}
