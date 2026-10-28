import { ChevronLeft, Lock } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card } from '@/components/ui';
import { getCourseTree, getMyState } from '@/lib/data';
import { getCatalogData, sql } from '@/lib/db';
import { canSeeLesson, getSettings, requireViewer } from '@/lib/session';
import type { Lesson, LessonComment } from '@/lib/types';
import { isDocId } from '@/lib/utils';
import { LessonComments } from './lesson-comments';
import { LessonView } from './lesson-view';

export const metadata: Metadata = { title: 'Aula' };

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isDocId(id)) notFound();
  const viewer = await requireViewer();
  const [lesson, settings, catalog] = await Promise.all([sql.one<Lesson>(`select * from lessons where id = $1`, [id]), getSettings(), getCatalogData()]);
  const course = lesson ? catalog.courses.find((c) => c.id === lesson.course_id) : undefined;

  if (!lesson || !canSeeLesson(viewer, lesson, course, settings.restrict_to_student_list)) {
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

  const [comments, tree, state] = await Promise.all([
    sql.query<LessonComment>(`select * from lesson_comments where lesson_id = $1 order by created_at desc limit 30`, [id]),
    getCourseTree(lesson.course_id, viewer),
    getMyState(viewer.userId),
  ]);
  const progress = state.progress;
  const prog = progress.find((x) => x.lesson_id === id);
  const ordered = tree.modules.flatMap((m) => tree.lessons.filter((l) => l.module_id === m.id));
  const idx = ordered.findIndex((l) => l.id === id);
  const completedIds = progress.filter((p) => p.course_id === lesson.course_id && p.completed).map((p) => p.lesson_id);

  return (
    <>
      <Link href={`/cursos/${lesson.course_id}`} className="mb-4 inline-flex max-w-full items-center gap-1 truncate text-sm font-semibold text-muted hover:text-ink">
        <ChevronLeft className="size-4 shrink-0" /> <span className="truncate">{course?.title ?? 'Curso'}</span>
      </Link>
      <LessonView
        lesson={lesson}
        materials={lesson.materials ?? []}
        modules={tree.modules.map((m) => ({ id: m.id, title: m.title }))}
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
