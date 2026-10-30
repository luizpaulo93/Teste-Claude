import { isDocId } from '@/lib/utils';
import { ChevronLeft, ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buttonClass, Card, PageHeader } from '@/components/ui';
import { sql } from '@/lib/db';
import type { Course, Lesson, LessonFolder, Module } from '@/lib/types';
import { getCatalogData } from '@/lib/db';
import { CourseForm } from '../course-form';
import { ModulesManager, type PickerLesson } from './modules-manager';

export const metadata: Metadata = { title: 'Editar curso · Admin' };

export default async function AdminCourseEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isDocId(id)) notFound();
  const [course, modules, lessons, folders, bank] = await Promise.all([
    sql.query<Course>(`select * from courses where id = $1`, [id]).then((r) => r[0] ?? null),
    sql.query<Module>(`select * from modules where course_id = $1 order by position, created_at`, [id]),
    // Aulas de cada módulo (na ordem do módulo)
    sql.query<Lesson>(
      `select l.*, ml.module_id, m.course_id, ml.position
         from module_lessons ml join lessons l on l.id = ml.lesson_id join modules m on m.id = ml.module_id
        where m.course_id = $1 order by ml.position, l.created_at`,
      [id],
    ),
    sql.query<LessonFolder>(`select id, name, position from lesson_folders order by position, created_at`),
    // Banco de aulas, para escolher o que entra em cada módulo
    sql.query<PickerLesson>(`select id, title, folder_id, youtube_id, thumbnail_url, materials from lessons order by position, created_at`),
  ]);
  if (!course) notFound();

  return (
    <>
      <Link href="/admin/cursos" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Cursos
      </Link>
      <PageHeader
        title={course.title}
        subtitle="Crie os módulos e adicione as aulas do banco de aulas (por pasta). Use as setas para reordenar."
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
          folders={folders}
          bank={bank}
        />
        <Card className="p-5 xl:sticky xl:top-6 xl:self-start">
          <p className="mb-4 text-sm font-bold text-ink">Dados do curso</p>
          <CourseForm course={course} tags={(await getCatalogData()).tags} />
        </Card>
      </div>
    </>
  );
}
