import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { db, fromQuery, getCatalogData } from '@/lib/db';
import type { Student } from '@/lib/types';
import { StudentsManager } from './students-manager';

export const metadata: Metadata = { title: 'Alunos · Admin' };
const PAGE = 50;

export default async function AdminStudents({ searchParams }: { searchParams: Promise<{ q?: string; turma?: string; status?: string; p?: string }> }) {
  const { q = '', turma = '', status = '', p = '1' } = await searchParams;
  const page = Math.max(1, Number(p) || 1);
  const d = db();
  const [snap, catalog] = await Promise.all([d.collection('students').get(), getCatalogData()]);
  const term = q.trim().toLowerCase();
  const filtered = fromQuery<Student>(snap)
    .filter((s) => !term || [s.name, s.email, s.phone].some((v) => String(v ?? '').toLowerCase().includes(term)))
    .filter((s) => (turma === 'none' ? !s.class_id : turma ? s.class_id === turma : true))
    .filter((s) => (status === 'active' || status === 'blocked' ? s.status === status : true))
    .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
  const students = filtered.slice((page - 1) * PAGE, page * PAGE);
  const emails = students.map((s) => s.email.toLowerCase());
  const profiles: { email: string; full_name: string; avatar_url: string }[] = [];
  for (let i = 0; i < emails.length; i += 30) {
    const r = await d.collection('users').where('email', 'in', emails.slice(i, i + 30)).select('email', 'full_name', 'avatar_url').get();
    profiles.push(...fromQuery<{ email: string; full_name: string; avatar_url: string }>(r));
  }
  const classes = [...catalog.classes].sort((a, b) => a.name.localeCompare(b.name));
  const count = filtered.length;

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
