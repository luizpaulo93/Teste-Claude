import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { sql } from '@/lib/db';
import type { Lesson, LessonFolder } from '@/lib/types';
import { LessonBank, type BankLesson } from './lesson-bank';

export const metadata: Metadata = { title: 'Aulas · Admin' };

export default async function AdminLessons({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const [folders, lessons] = await Promise.all([
    sql.query<LessonFolder>(`select id, name, position from lesson_folders order by position, created_at`),
    sql.query<BankLesson>(
      `select l.id, l.title, l.description, l.youtube_id, l.duration, l.thumbnail_url, l.is_free, l.is_published, l.materials, l.folder_id, l.position,
              (select count(*)::int from module_lessons ml where ml.lesson_id = l.id) as uses,
              (select s.id from live_sessions s where s.lesson_id = l.id
                  or (s.youtube_id <> '' and s.youtube_id = l.youtube_id
                      and exists (select 1 from lesson_folders f where f.id = l.folder_id and lower(f.name) in ('live', 'lives')))
                order by (s.lesson_id = l.id) desc nulls last limit 1) as live_id
         from lessons l order by l.position, l.created_at`,
    ),
  ]);
  const current = f === 'none' ? null : folders.find((x) => x.id === f)?.id ?? (f ? null : (folders[0]?.id ?? null));
  return (
    <>
      <PageHeader
        title="Banco de aulas"
      />
      <LessonBank folders={folders} lessons={lessons as (BankLesson & Lesson)[]} current={current} />
    </>
  );
}
