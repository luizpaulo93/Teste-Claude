import { ChevronLeft, ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buttonClass, Card, PageHeader } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import type { Course, Lesson, LessonMaterial, Module } from '@/lib/types';
import { CourseForm } from '../course-form';
import { ModulesManager } from './modules-manager';

export const metadata: Metadata = { title: 'Editar curso · Admin' };

export default async function AdminCourseEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: course }, { data: modules }, { data: lessons }] = await Promise.all([
    supabase.from('courses').select('*').eq('id', id).maybeSingle(),
    supabase.from('modules').select('*').eq('course_id', id).order('position').order('created_at'),
    supabase.from('lessons').select('*').eq('course_id', id).order('position').order('created_at'),
  ]);
  if (!course) notFound();
  const lessonIds = (lessons ?? []).map((l: Lesson) => l.id);
  const { data: materials } = lessonIds.length
    ? await supabase.from('lesson_materials').select('*').in('lesson_id', lessonIds).order('position')
    : { data: [] };

  return (
    <>
      <Link href="/admin/cursos" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Cursos
      </Link>
      <PageHeader
        title={(course as Course).title}
        subtitle="Organize módulos e aulas. Use as setas para reordenar."
        actions={
          <Link href={`/cursos/${id}`} target="_blank" className={buttonClass('secondary')}>
            <ExternalLink className="size-4" /> Ver como aluno
          </Link>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <ModulesManager
          courseId={id}
          modules={(modules ?? []) as Module[]}
          lessons={(lessons ?? []) as Lesson[]}
          materials={(materials ?? []) as LessonMaterial[]}
        />
        <Card className="p-5 xl:sticky xl:top-6 xl:self-start">
          <p className="mb-4 text-sm font-bold text-ink">Dados do curso</p>
          <CourseForm course={course as Course} />
        </Card>
      </div>
    </>
  );
}
