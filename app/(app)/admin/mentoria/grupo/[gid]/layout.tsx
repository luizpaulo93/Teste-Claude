import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { sql } from '@/lib/db';
import { daysUntil } from '@/lib/mentoria';
import { getGroup, groupMembers, pendingDoubts } from '@/lib/mentoria-space';
import { isDocId } from '@/lib/utils';
import { MentoriaTabs } from '../../../../mentoria/tabs';
import { GroupAdminActions } from './group-admin-actions';

export default async function GroupLayout({ children, params }: { children: React.ReactNode; params: Promise<{ gid: string }> }) {
  const { gid } = await params;
  if (!isDocId(gid)) notFound();
  const g = await getGroup(gid);
  if (!g) notFound();
  const [members, pending, students, classes] = await Promise.all([
    groupMembers(g),
    pendingDoubts(),
    sql.query<{ email: string; name: string; class_id: string | null }>(
      `select email, coalesce(nullif(name, ''), email) as name, class_id from students order by lower(coalesce(nullif(name, ''), email)) limit 5000`,
    ),
    sql.query<{ id: string; name: string; count: number }>(
      `select c.id, c.name, (select count(*)::int from students s where s.class_id = c.id and s.status = 'active') as count from classes c order by c.name`,
    ),
  ]);
  const left = daysUntil(g.exam_date);
  const base = `/admin/mentoria/grupo/${g.id}`;
  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/mentoria" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
          <ChevronLeft className="size-4" /> Mentoria
        </Link>
        <PageHeader
          eyebrow="Mentoria em grupo"
          title={g.name}
          subtitle={[`${members.length} aluno${members.length === 1 ? '' : 's'}`, g.exam_target, left !== null && left >= 0 ? `${left} dias para a prova` : ''].filter(Boolean).join(' · ')}
          actions={<GroupAdminActions group={g} students={students} classes={classes} />}
        />
      </div>
      <MentoriaTabs
        base={base}
        tabs={[
          { href: '', label: 'Cronograma' },
          { href: '/alunos', label: 'Alunos' },
          { href: '/duvidas', label: 'Dúvidas', badge: pending.get(`g:${g.id}`) ?? 0 },
          { href: '/lives', label: 'Lives' },
        ]}
      />
      {children}
    </div>
  );
}
