import type { Metadata } from 'next';
import { BookOpen } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/ui';
import { getCatalogData } from '@/lib/db';
import { CourseList, NewCourseButton } from './course-list';
import { TagsManager } from './course-tags';

export const metadata: Metadata = { title: 'Cursos · Admin' };

export default async function AdminCourses() {
  const { courses, lessons, tags } = await getCatalogData();
  const tagCounts: Record<string, number> = {};
  courses.forEach((c) => (c.tag_ids ?? []).forEach((t) => (tagCounts[t] = (tagCounts[t] ?? 0) + 1)));
  const counts: Record<string, number> = {};
  // Aulas distintas por curso (a mesma aula pode estar em mais de um módulo)
  const seen = new Set<string>();
  lessons.forEach((l) => {
    const k = `${l.course_id}:${l.id}`;
    if (seen.has(k)) return;
    seen.add(k);
    counts[l.course_id] = (counts[l.course_id] ?? 0) + 1;
  });
  return (
    <>
      <PageHeader title="Cursos" subtitle="Crie cursos, organize em módulos e publique aulas." actions={<NewCourseButton tags={tags} />} />
      <TagsManager tags={tags} counts={tagCounts} />
      {courses.length ? (
        <CourseList courses={courses} counts={counts} />
      ) : (
        <EmptyState icon={<BookOpen className="size-6" />} title="Nenhum curso criado" description="Comece criando seu primeiro curso." action={<NewCourseButton tags={tags} />} />
      )}
    </>
  );
}
