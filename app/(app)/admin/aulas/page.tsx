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
              (select count(*)::int from module_lessons ml where ml.lesson_id = l.id) as uses
         from lessons l order by l.position, l.created_at`,
    ),
  ]);
  const current = f === 'none' ? null : folders.find((x) => x.id === f)?.id ?? (f ? null : (folders[0]?.id ?? null));
  return (
    <>
      <PageHeader
        title="Banco de aulas"
        subtitle="Organize as aulas em pastas. Depois, em Cursos, monte cada módulo escolhendo as aulas daqui (a mesma aula pode estar em vários cursos)."
      />
      <LessonBank folders={folders} lessons={lessons as (BankLesson & Lesson)[]} current={current} />
    </>
  );
}
