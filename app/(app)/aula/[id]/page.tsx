import { Lock } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card } from '@/components/ui';
import { getCourseTree, getMyState, lessonPlacement } from '@/lib/data';
import { getCatalogData, sql } from '@/lib/db';
import { requireViewer } from '@/lib/session';
import type { Lesson, LessonComment } from '@/lib/types';
import { isDocId } from '@/lib/utils';
import { LessonComments } from './lesson-comments';
import { LessonView } from './lesson-view';

export const metadata: Metadata = { title: 'Aula' };

export default async function LessonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ c?: string }> }) {
  const [{ id }, { c }] = await Promise.all([params, searchParams]);
  if (!isDocId(id)) notFound();
  const viewer = await requireViewer();
  // Tudo em paralelo (uma ida ao banco): aula, comentários e progresso do aluno
  const [row, place, catalog, comments, state] = await Promise.all([
    sql.one<Lesson>(`select * from lessons where id = $1`, [id]),
    lessonPlacement(viewer, id, c),
    getCatalogData(),
    sql.query<LessonComment>(`select * from lesson_comments where lesson_id = $1 order by created_at desc limit 30`, [id]),
    getMyState(viewer.userId),
  ]);
  // A aula pode estar em vários cursos: usa o curso de onde o aluno veio (?c=) ou o primeiro liberado
  const lesson = row && (place || viewer.isAdmin) ? { ...row, course_id: place?.course_id ?? '', module_id: place?.module_id ?? '' } : null;
  const course = lesson ? catalog.courses.find((x) => x.id === lesson.course_id) : undefined;

  if (!lesson) {
    return (
      <Card className="mx-auto mt-10 flex max-w-md flex-col items-center p-10 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
          <Lock className="size-6" />
        </div>
        <p className="mt-4 text-lg font-bold text-ink">Aula indisponível</p>
        <p className="mt-1 text-sm text-muted">Esta aula não existe ou ainda não foi liberada para você.</p>
        <Link href="/cursos" className="mt-5 text-sm font-semibold text-brand">
          Voltar aos cursos
        </Link>
      </Card>
    );
  }

  const tree = lesson.course_id ? await getCourseTree(lesson.course_id, viewer) : { course: null, modules: [], lessons: [] }; // vem do cache do catálogo
  const progress = state.progress;
  const prog = progress.find((x) => x.lesson_id === id);
  // Só as aulas da playlist (módulo) atual: lista, anterior/próxima e "próxima aula" no fim do vídeo
  const ordered = tree.lessons.filter((l) => l.module_id === lesson.module_id);
  const idx = ordered.findIndex((l) => l.id === id);
  const completedIds = progress.filter((p) => p.completed).map((p) => p.lesson_id);

  return (
    <>
      <LessonView
        courseTitle={course?.title ?? 'Curso'}
        courseHref={`/cursos/${lesson.course_id}`}
        lesson={lesson}
        materials={lesson.materials ?? []}
        modules={tree.modules.filter((m) => m.id === lesson.module_id).map((m) => ({ id: m.id, title: m.title }))}
        lessons={ordered.map((l) => ({
          id: l.id,
          title: l.title,
          duration: l.duration,
          module_id: l.module_id,
          thumb: l.thumbnail_url || (l.youtube_id ? `https://i.ytimg.com/vi/${l.youtube_id}/mqdefault.jpg` : ''),
        }))}
        completedIds={completedIds}
        initialCompleted={Boolean(prog?.completed)}
        initialFavorite={state.favorites.some((f) => f.lesson_id === id)}
        startAt={prog?.completed ? 0 : (prog?.position_sec ?? 0)}
        prevId={idx > 0 ? ordered[idx - 1].id : null}
        nextId={idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1].id : null}
        userId={viewer.userId}
        pdfOwner={viewer.isAdmin ? null : { name: viewer.student?.name || viewer.profile.full_name || viewer.email, cpf: viewer.student?.cpf ?? '' }}
        watermark={`${viewer.profile.full_name || ''} · ${viewer.email}`.trim()}
        comments={
          <LessonComments
            lessonId={id}
            initial={comments}
            me={{ id: viewer.userId, full_name: viewer.profile.full_name || viewer.email, avatar_url: viewer.profile.avatar_url, role: viewer.profile.role }}
            isAdmin={viewer.isAdmin}
          />
        }
      />
    </>
  );
}
