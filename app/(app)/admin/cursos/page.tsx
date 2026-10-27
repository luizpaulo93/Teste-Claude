import type { Metadata } from 'next';
import { BookOpen } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import type { Course } from '@/lib/types';
import { CourseList, NewCourseButton } from './course-list';

export const metadata: Metadata = { title: 'Cursos · Admin' };

export default async function AdminCourses() {
  const supabase = await createClient();
  const [{ data }, { data: lessons }] = await Promise.all([
    supabase.from('courses').select('*').order('position').order('created_at'),
    supabase.from('lessons').select('course_id'),
  ]);
  const counts: Record<string, number> = {};
  (lessons ?? []).forEach((l: { course_id: string }) => (counts[l.course_id] = (counts[l.course_id] ?? 0) + 1));
  const courses = (data ?? []) as Course[];
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
