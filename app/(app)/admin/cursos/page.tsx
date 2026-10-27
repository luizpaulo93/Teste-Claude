import type { Metadata } from 'next';
import { BookOpen } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/ui';
import { getCatalogData } from '@/lib/db';
import { CourseList, NewCourseButton } from './course-list';

export const metadata: Metadata = { title: 'Cursos · Admin' };

export default async function AdminCourses() {
  const { courses, lessons } = await getCatalogData();
  const counts: Record<string, number> = {};
  lessons.forEach((l) => (counts[l.course_id] = (counts[l.course_id] ?? 0) + 1));
  return (
    <>
      <PageHeader title="Cursos" subtitle="Crie cursos, organize em módulos e publique aulas." actions={<NewCourseButton />} />
      {courses.length ? (
        <CourseList courses={courses} counts={counts} />
      ) : (
        <EmptyState icon={<BookOpen className="size-6" />} title="Nenhum curso criado" description="Comece criando seu primeiro curso." action={<NewCourseButton />} />
      )}
    </>
  );
}
