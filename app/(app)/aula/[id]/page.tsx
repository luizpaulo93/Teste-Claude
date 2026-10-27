import { ChevronLeft, Lock } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card } from '@/components/ui';
import { getCourseTree } from '@/lib/data';
import { requireViewer } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { Lesson, LessonComment, LessonMaterial, ProfileCard } from '@/lib/types';
import { LessonComments } from './lesson-comments';
import { LessonView } from './lesson-view';

export const metadata: Metadata = { title: 'Aula' };

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const viewer = await requireViewer();
  const supabase = await createClient();

  const [{ data: lesson }, { data: materials }, { data: prog }, { data: fav }, { data: comments }] = await Promise.all([
    supabase.from('lessons').select('*').eq('id', id).maybeSingle(),
    supabase.from('lesson_materials').select('*').eq('lesson_id', id).order('position'),
    supabase.from('lesson_progress').select('completed,position_sec').eq('user_id', viewer.userId).eq('lesson_id', id).maybeSingle(),
    supabase.from('favorites').select('lesson_id').eq('user_id', viewer.userId).eq('lesson_id', id).maybeSingle(),
    supabase.from('lesson_comments').select('*').eq('lesson_id', id).order('created_at', { ascending: false }).limit(100),
  ]);
  const commentList = (comments ?? []) as LessonComment[];
  const authorIds = [...new Set(commentList.map((c) => c.author_id))];
  const { data: cards } = authorIds.length ? await supabase.from('profile_cards').select('*').in('id', authorIds) : { data: [] };

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

  const { course, modules, lessons } = await getCourseTree((lesson as Lesson).course_id);
  const { data: progressRows } = await supabase
    .from('lesson_progress')
    .select('lesson_id')
    .eq('user_id', viewer.userId)
    .eq('course_id', (lesson as Lesson).course_id)
    .eq('completed', true);

  const ordered = modules.flatMap((m) => lessons.filter((l) => l.module_id === m.id));
  const idx = ordered.findIndex((l) => l.id === id);

  return (
    <>
      <Link
        href={`/cursos/${(lesson as Lesson).course_id}`}
        className="mb-4 inline-flex max-w-full items-center gap-1 truncate text-sm font-semibold text-muted hover:text-ink"
      >
        <ChevronLeft className="size-4 shrink-0" /> <span className="truncate">{course?.title ?? 'Curso'}</span>
      </Link>
      <LessonView
        lesson={lesson as Lesson}
        materials={(materials ?? []) as LessonMaterial[]}
        modules={modules.map((m) => ({ id: m.id, title: m.title }))}
        lessons={ordered.map((l) => ({ id: l.id, title: l.title, duration: l.duration, module_id: l.module_id, thumb: l.thumbnail_url || (l.youtube_id ? `https://i.ytimg.com/vi/${l.youtube_id}/mqdefault.jpg` : '') }))}
        completedIds={(progressRows ?? []).map((r: { lesson_id: string }) => r.lesson_id)}
        initialCompleted={Boolean(prog?.completed)}
        initialFavorite={Boolean(fav)}
        startAt={prog?.completed ? 0 : (prog?.position_sec ?? 0)}
        prevId={idx > 0 ? ordered[idx - 1].id : null}
        nextId={idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1].id : null}
        userId={viewer.userId}
        watermark={`${viewer.profile.full_name || ''} · ${viewer.email}`.trim()}
        comments={
          <LessonComments
            lessonId={id}
            initial={commentList}
            authors={(cards ?? []) as ProfileCard[]}
            me={{ id: viewer.userId, full_name: viewer.profile.full_name || viewer.email, avatar_url: viewer.profile.avatar_url, role: viewer.profile.role }}
            isAdmin={viewer.isAdmin}
          />
        }
      />
    </>
  );
}
