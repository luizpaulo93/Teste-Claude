import { isDocId } from '@/lib/utils';
import { ChevronLeft, ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buttonClass, Card, PageHeader } from '@/components/ui';
import { byPosition, db, fromDoc, fromQuery } from '@/lib/db';
import type { Course, Lesson, Module } from '@/lib/types';
import { CourseForm } from '../course-form';
import { ModulesManager } from './modules-manager';

export const metadata: Metadata = { title: 'Editar curso · Admin' };

export default async function AdminCourseEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isDocId(id)) notFound();
  const d = db();
  const [courseSnap, modSnap, lessonSnap] = await Promise.all([
    d.doc(`courses/${id}`).get(),
    d.collection('modules').where('course_id', '==', id).get(),
    d.collection('lessons').where('course_id', '==', id).get(),
  ]);
  const course = fromDoc<Course>(courseSnap);
  if (!course) notFound();
  const modules = fromQuery<Module>(modSnap).sort(byPosition);
  const lessons = fromQuery<Lesson>(lessonSnap).sort(byPosition);

  return (
    <>
      <Link href="/admin/cursos" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Cursos
      </Link>
      <PageHeader
        title={course.title}
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
          modules={modules}
          lessons={lessons}
        />
        <Card className="p-5 xl:sticky xl:top-6 xl:self-start">
          <p className="mb-4 text-sm font-bold text-ink">Dados do curso</p>
          <CourseForm course={course} />
        </Card>
      </div>
    </>
  );
}
