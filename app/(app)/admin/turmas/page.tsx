import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { getCatalogData, sql } from '@/lib/db';
import { ClassesManager } from './classes-manager';

export const metadata: Metadata = { title: 'Turmas · Admin' };

export default async function AdminClasses() {
  const [catalog, rows] = await Promise.all([
    getCatalogData(),
    sql.query<{ class_id: string; n: number }>(`select class_id, count(*)::int as n from students where class_id is not null group by 1`),
  ]);
  const counts: Record<string, number> = Object.fromEntries(rows.map((r) => [r.class_id, r.n]));
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
