import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import type { ClassGroup, Student } from '@/lib/types';
import { StudentsManager } from './students-manager';

export const metadata: Metadata = { title: 'Alunos · Admin' };
const PAGE = 50;

export default async function AdminStudents({ searchParams }: { searchParams: Promise<{ q?: string; turma?: string; status?: string; p?: string }> }) {
  const { q = '', turma = '', status = '', p = '1' } = await searchParams;
  const page = Math.max(1, Number(p) || 1);
  const supabase = await createClient();

  let query = supabase.from('students').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  const term = q.trim().replace(/[%,()]/g, '');
  if (term) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
  if (turma === 'none') query = query.is('class_id', null);
  else if (turma) query = query.eq('class_id', turma);
  if (status === 'active' || status === 'blocked') query = query.eq('status', status);

  const [{ data, count }, { data: classes }] = await Promise.all([query, supabase.from('classes').select('id,name,description,access_all').order('name')]);
  const students = (data ?? []) as Student[];
  const { data: profiles } = students.length
    ? await supabase.from('profiles').select('email,full_name,avatar_url').in('email', students.map((s) => s.email.toLowerCase()))
    : { data: [] };

  return (
    <>
      <PageHeader title="Alunos" subtitle="Somente e-mails desta lista (ativos e com turma) acessam o conteúdo pago." />
      <StudentsManager
        students={students}
        classes={(classes ?? []) as ClassGroup[]}
        profiles={(profiles ?? []) as { email: string; full_name: string; avatar_url: string }[]}
        total={count ?? 0}
        page={page}
        pageSize={PAGE}
        filters={{ q, turma, status }}
      />
    </>
  );
}
