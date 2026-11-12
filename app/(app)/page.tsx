import { BarChart3, CalendarDays, ChevronRight, ClipboardCheck, FileQuestion, GraduationCap, Lock, Play, Radio, Shield, Target } from 'lucide-react';
import Link from 'next/link';
import { CourseCard, CoverFallback } from '@/components/course/course-card';
import { Rail } from '@/components/home/rail';
import { LiveCard } from '@/components/live/live-card';
import { Card, Img, SectionHeader } from '@/components/ui';
import { EVENT_COLORS, eventColor } from '@/lib/calendar';
import { sql } from '@/lib/db';
import { courseProgress, getCatalog, getMyProgress, getUpcomingEvents, visibleLessons } from '@/lib/data';
import { visibleLives } from '@/lib/live';
import { canAccessCourse, getSettings, requireViewer } from '@/lib/session';
import type { LiveSession } from '@/lib/types';
import { cn, firstName, formatDate, youtubeThumb } from '@/lib/utils';

export default async function HomePage() {
  const viewer = await requireViewer();
  const [settings, { courses, lessonCount, courseLessons }, progress, events, lives, answered] = await Promise.all([
    getSettings(),
    getCatalog(),
    getMyProgress(viewer.userId),
    getUpcomingEvents(5),
    visibleLives(viewer, ['live', 'scheduled']),
    sql
      .one<{ n: number; ok: number }>(`select count(*)::int as n, count(*) filter (where correct)::int as ok from question_answers where user_id = $1`, [viewer.userId])
      .catch(() => null),
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
  const soon = lives
    .filter((l) => l.status === 'scheduled')
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, 10);
  const name = firstName(viewer.profile.full_name);

  const resumeCourse = resume?.lesson ? courses.find((c) => c.id === resume.lesson!.course_id) : undefined;
  const resumePct = resume && resume.p.duration_sec > 0 ? Math.min(98, Math.max(4, Math.round((resume.p.position_sec / resume.p.duration_sec) * 100))) : 0;

  // números do aluno e atalhos do painel de abertura
  const doneLessons = progress.filter((p) => p.completed).length;
  const stats = [
    { label: 'aulas concluídas', value: String(doneLessons) },
    { label: 'questões respondidas', value: String(answered?.n ?? 0) },
    { label: 'de acerto', value: answered?.n ? `${Math.round((answered.ok / answered.n) * 100)}%` : '–' },
  ];
  const shortcuts = viewer.isAdmin
    ? [
        { href: '/admin', label: 'Painel', icon: Shield, tone: 'from-sky-500 to-blue-600' },
        { href: '/admin/questoes', label: 'Questões', icon: FileQuestion, tone: 'from-emerald-500 to-teal-600' },
        { href: '/admin/ao-vivo', label: 'Ao vivo', icon: Radio, tone: 'from-rose-500 to-red-600' },
        { href: '/admin/mentoria', label: 'Mentoria', icon: Target, tone: 'from-violet-500 to-indigo-600' },
      ]
    : [
        { href: '/questoes', label: 'Exercícios', icon: FileQuestion, tone: 'from-emerald-500 to-teal-600' },
        { href: '/simulados', label: 'Simulados', icon: ClipboardCheck, tone: 'from-sky-500 to-blue-600' },
        { href: '/desempenho', label: 'Desempenho', icon: BarChart3, tone: 'from-amber-500 to-orange-600' },
        viewer.hasMentoria
          ? { href: '/mentoria', label: 'Mentoria', icon: Target, tone: 'from-violet-500 to-indigo-600' }
          : { href: '/calendario', label: 'Calendário', icon: CalendarDays, tone: 'from-violet-500 to-indigo-600' },
      ];
  const cta = liveNow[0]
    ? { href: `/ao-vivo/${liveNow[0].id}`, label: 'Entrar na live', live: true }
    : resume?.lesson
      ? { href: `/aula/${resume.lesson.id}`, label: 'Continuar de onde parei', live: false }
      : { href: '/cursos', label: 'Ver os cursos', live: false };

  return (
    <div className="home-stagger mx-auto max-w-[1360px] space-y-8 pt-1 sm:pt-4">
      {/* Abertura: painel com movimento, números do aluno e atalhos */}
      <section className="relative isolate overflow-hidden rounded-3xl border border-white/10 bg-[#070b1a] p-5 text-white shadow-2xl sm:p-8 lg:p-10">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="lp-orb absolute -top-24 -left-16 size-72 rounded-full bg-blue-600/45 blur-3xl" />
          <div className="lp-orb absolute -right-20 -bottom-28 size-80 rounded-full bg-violet-600/35 blur-3xl [animation-delay:-6s]" />
          <div className="lp-orb absolute top-1/3 left-1/2 size-56 rounded-full bg-cyan-500/20 blur-3xl [animation-delay:-11s]" />
          <div className="lp-grid-bg absolute inset-0" />
        </div>
        <div className="grid items-center gap-7 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0 space-y-4">
            {name && (
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-bold tracking-[0.18em] uppercase backdrop-blur">
                <GraduationCap className="size-3.5 text-sky-300" /> Olá, {name}
              </p>
            )}
            <h1 className="max-w-2xl text-[26px] leading-tight font-extrabold tracking-tight text-balance sm:text-4xl lg:text-[44px]">
              <span className="lp-gradient-text">{settings.hero_title}</span>
            </h1>
            {settings.hero_subtitle && <p className="max-w-xl text-sm text-white/70 sm:text-base">{settings.hero_subtitle}</p>}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href={cta.href}
                className={cn(
                  'lp-shine inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:scale-[1.02] active:scale-[0.98]',
                  cta.live ? 'bg-rose-600 shadow-rose-600/30' : 'bg-brand shadow-brand/30',
                )}
              >
                {cta.live ? <Radio className="size-4 animate-pulse" /> : <Play className="size-4 fill-current" />} {cta.label}
              </Link>
            </div>
          </div>
          {viewer.isMember && !viewer.isAdmin && (
            <dl className="grid grid-cols-3 gap-2.5 lg:w-[380px]">
              {stats.map((st) => (
                <div key={st.label} className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3.5 text-center backdrop-blur">
                  <dd className="text-2xl font-extrabold tabular-nums sm:text-3xl">{st.value}</dd>
                  <dt className="mt-0.5 text-[10px] leading-tight font-semibold text-white/60 sm:text-[11px]">{st.label}</dt>
                </div>
              ))}
            </dl>
          )}
        </div>
        {(viewer.isMember || viewer.isAdmin) && (
          <nav aria-label="Atalhos" className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {shortcuts.map((sc) => (
              <Link
                key={sc.href}
                href={sc.href}
                className="group flex min-w-0 items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.05] p-2.5 backdrop-blur sm:p-3 transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.1]"
              >
                <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-lg transition-transform group-hover:scale-110', sc.tone)}>
                  <sc.icon className="size-[18px]" />
                </span>
                <span className="min-w-0 flex-1 text-[13px] leading-tight font-bold break-words sm:text-sm">{sc.label}</span>
                <ChevronRight className="hidden size-4 shrink-0 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white lg:block" />
              </Link>
            ))}
          </nav>
        )}
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
        <section key={l.id}>
          <SectionHeader title="Ao vivo agora" icon={<span className="size-2.5 shrink-0 animate-pulse rounded-full bg-rose-500" />} />
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
        <section>
          <SectionHeader title="Continuar assistindo" />
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
          action={
            <Link href="/cursos" className="text-xs font-semibold text-brand">
              Ver tudo
            </Link>
          }
        >
          {mine.map((course, i) => {
            const total = lessonCount.get(course.id) ?? 0;
            return (
              <div key={course.id} className="w-[40%] shrink-0 sm:w-[180px] lg:w-[200px]">
                <CourseCard course={course} locked={false} lessons={total} progress={courseProgress(courseLessons.get(course.id), progress)} priority={i < 5} />
              </div>
            );
          })}
        </Rail>
      )}

      {/* Próximos aulões */}
      {soon.length > 0 && (
        <Rail
          title="Agendamentos"
          action={
            <Link href="/ao-vivo" className="text-xs font-semibold text-brand">
              Ver todos
            </Link>
          }
        >
          {soon.map((l) => (
            <LiveCard key={l.id} live={l} className="w-[40%] shrink-0 sm:w-[180px] lg:w-[200px]" />
          ))}
        </Rail>
      )}

      {others.length > 0 && (
        <Rail title={mine.length ? 'Outros cursos' : 'Cursos'}>
          {others.map((course) => (
            <div key={course.id} className="w-[40%] shrink-0 sm:w-[180px] lg:w-[200px]">
              <CourseCard course={course} locked lessons={lessonCount.get(course.id) ?? 0} progress={0} />
            </div>
          ))}
        </Rail>
      )}

      {!courses.length && <p className="text-sm text-muted">Nenhum curso publicado ainda.</p>}

      {/* Datas e eventos: um embaixo do outro no celular, lado a lado no tablet/PC */}
      {events.length > 0 && (
        <section>
          <SectionHeader title="Datas e eventos" href="/calendario" link="Calendário" />
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => {
              const color = EVENT_COLORS[eventColor(e.category, e.color)] ?? EVENT_COLORS.blue;
              return (
                <Link
                  key={e.id}
                  href={`/calendario?d=${e.start_date}`}
                  className="flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3 transition hover:bg-surface-2 sm:w-72"
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
          </div>
        </section>
      )}
    </div>
  );
}
