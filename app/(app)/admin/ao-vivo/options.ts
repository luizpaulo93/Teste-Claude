import 'server-only';
import { getCatalogData, sql } from '@/lib/db';
import type { AudienceOptions } from './lives-manager';

/** Quem pode assistir: turmas, mentorias (individual/grupo), alunos e cursos. */
export async function liveAudienceOptions(): Promise<{ options: AudienceOptions; spaces: { key: string; label: string }[] }> {
  const [catalog, groups, singles, classes, students] = await Promise.all([
    getCatalogData(),
    sql.query<{ id: string; name: string }>(`select id, name from mentoria_groups order by name`),
    sql.query<{ id: string; name: string; email: string }>(
      `select id, coalesce(nullif(student_name, ''), student_email) as name, student_email as email from mentorias where group_id is null order by 2`,
    ),
    sql.query<{ id: string; name: string; course_ids: string[]; access_all: boolean }>(`select id, name, course_ids, access_all from classes order by name`),
    sql.query<{ id: string; name: string }>(`select id, coalesce(nullif(name, ''), email) as name from students order by 2 limit 5000`),
  ]);
  const spaces = [
    ...groups.map((g) => ({ key: `g:${g.id}`, label: `${g.name} (grupo)` })),
    ...singles.map((m) => ({
      key: `m:${m.id}`,
      // nomes iguais: mostra o e-mail para diferenciar
      label: singles.filter((x) => x.name === m.name).length > 1 ? `${m.name} (${m.email})` : m.name,
    })),
  ];
  return {
    spaces,
    options: {
      classes: classes.map((c) => ({ key: `c:${c.id}`, label: c.name, courseIds: c.course_ids ?? [], all: c.access_all })),
      mentorias: spaces,
      students: students.map((x) => ({ key: `u:${x.id}`, label: x.name, sub: x.id })),
      courses: catalog.courses.map((c) => ({ key: `course:${c.id}`, label: c.title })),
    },
  };
}
