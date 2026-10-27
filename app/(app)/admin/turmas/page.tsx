import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import type { ClassGroup, Course } from '@/lib/types';
import { ClassesManager } from './classes-manager';

export const metadata: Metadata = { title: 'Turmas · Admin' };

export default async function AdminClasses() {
  const supabase = await createClient();
  const [{ data: classes }, { data: links }, { data: courses }, { data: students }] = await Promise.all([
    supabase.from('classes').select('*').order('name'),
    supabase.from('class_courses').select('class_id,course_id'),
    supabase.from('courses').select('id,title,is_free').order('position'),
    supabase.from('students').select('class_id'),
  ]);
  const counts: Record<string, number> = {};
  (students ?? []).forEach((s: { class_id: string | null }) => s.class_id && (counts[s.class_id] = (counts[s.class_id] ?? 0) + 1));
  return (
    <>
      <PageHeader title="Turmas" subtitle="Cada turma define quais cursos seus alunos podem acessar." />
      <ClassesManager
        classes={(classes ?? []) as ClassGroup[]}
        links={(links ?? []) as { class_id: string; course_id: string }[]}
        courses={(courses ?? []) as Pick<Course, 'id' | 'title' | 'is_free'>[]}
        counts={counts}
      />
    </>
  );
}
