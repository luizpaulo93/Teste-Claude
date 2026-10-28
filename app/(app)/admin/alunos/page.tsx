import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { getCatalogData, sql } from '@/lib/db';
import type { Student } from '@/lib/types';
import { StudentsManager } from './students-manager';

export const metadata: Metadata = { title: 'Alunos · Admin' };
const PAGE = 50;

export default async function AdminStudents({ searchParams }: { searchParams: Promise<{ q?: string; turma?: string; status?: string; p?: string }> }) {
  const { q = '', turma = '', status = '', p = '1' } = await searchParams;
  const page = Math.min(10_000, Math.max(1, Math.floor(Number(p)) || 1));
  const term = q.trim().toLowerCase();
  // Filtros e paginação direto no banco (rápido mesmo com milhares de alunos)
  const where: string[] = [];
  const args: unknown[] = [];
  if (term) {
    args.push(`%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    where.push(`(lower(s.name) like $${args.length} or s.email like $${args.length} or s.phone like $${args.length})`);
  }
  if (turma === 'none') where.push('s.class_id is null');
  else if (turma) {
    args.push(turma);
    where.push(`s.class_id = $${args.length}`);
  }
  if (status === 'active' || status === 'blocked') {
    args.push(status);
    where.push(`s.status = $${args.length}`);
  }
  const filter = where.length ? `where ${where.join(' and ')}` : '';
  const [rows, catalog] = await Promise.all([
    sql.query<Student & { total: number; full_name: string | null; avatar_url: string | null }>(
      `select s.*, count(*) over () as total, u.full_name, u.avatar_url
         from students s
         left join lateral (select full_name, avatar_url from users where email = s.email limit 1) u on true
         ${filter}
         order by s.created_at desc
         limit ${PAGE} offset ${(page - 1) * PAGE}`,
      args,
    ),
    getCatalogData(),
  ]);
  const students: Student[] = rows.map(({ total: _t, full_name: _f, avatar_url: _a, ...st }) => st);
  const profiles = rows.filter((r) => r.full_name !== null).map((r) => ({ email: r.email, full_name: r.full_name ?? '', avatar_url: r.avatar_url ?? '' }));
  const classes = [...catalog.classes].sort((a, b) => a.name.localeCompare(b.name));
  const count = rows[0]?.total ?? 0;

  return (
    <>
      <PageHeader title="Alunos" subtitle="Somente e-mails desta lista (ativos e com turma) acessam o conteúdo pago." />
      <StudentsManager
        students={students}
        classes={classes}
        profiles={profiles}
        total={count}
        page={page}
        pageSize={PAGE}
        filters={{ q, turma, status }}
      />
    </>
  );
}
