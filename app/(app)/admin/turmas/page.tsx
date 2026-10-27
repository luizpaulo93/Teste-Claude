import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { db, getCatalogData } from '@/lib/db';
import { ClassesManager } from './classes-manager';

export const metadata: Metadata = { title: 'Turmas · Admin' };

export default async function AdminClasses() {
  const [catalog, studentsSnap] = await Promise.all([getCatalogData(), db().collection('students').select('class_id').get()]);
  const counts: Record<string, number> = {};
  studentsSnap.docs.forEach((s) => {
    const c = s.get('class_id') as string | null;
    if (c) counts[c] = (counts[c] ?? 0) + 1;
  });
  const classes = [...catalog.classes].sort((a, b) => a.name.localeCompare(b.name));
  const links = classes.flatMap((c) => c.course_ids.map((course_id) => ({ class_id: c.id, course_id })));

  return (
    <>
      <PageHeader title="Turmas" subtitle="Cada turma define quais cursos seus alunos podem acessar." />
      <ClassesManager
        classes={classes}
        links={links}
        courses={catalog.courses.map((c) => ({ id: c.id, title: c.title, is_free: c.is_free }))}
        counts={counts}
      />
    </>
  );
}
