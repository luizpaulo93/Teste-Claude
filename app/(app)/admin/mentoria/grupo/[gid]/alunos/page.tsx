import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Avatar, Badge } from '@/components/ui';
import { emailKey, sql } from '@/lib/db';
import { getGroup, groupMembers } from '@/lib/mentoria-space';

/** Alunos do grupo e em que parte do cronograma cada um está. */
export default async function GroupStudents({ params }: { params: Promise<{ gid: string }> }) {
  const g = await getGroup((await params).gid);
  if (!g) notFound();
  const members = await groupMembers(g);
  const stats = await sql.query<{ id: string; studied: number; total: number; group_id: string | null }>(
    `select m.id, m.group_id, (select count(*)::int from mentoria_cards c where c.mentoria_id = m.id and c.level > 0) as studied,
            (select count(*)::int from mentoria_cards c where c.mentoria_id = m.id) as total
       from mentorias m where m.id = any($1)`,
    [members.map((x) => emailKey(x.email))],
  );
  const by = new Map(stats.map((s) => [s.id, s]));
  if (!members.length) return <p className="text-sm text-muted">Nenhum aluno no grupo. Toque em Editar para escolher alunos ou turmas.</p>;
  return (
    <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
      {members.map((mb) => {
        const s = by.get(emailKey(mb.email));
        return (
          <li key={mb.email} className="border-b border-line last:border-b-0">
            <Link href={`/admin/mentoria/${encodeURIComponent(emailKey(mb.email))}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2">
              <Avatar name={mb.name} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{mb.name}</span>
                <span className="block truncate text-[11px] text-muted">{mb.email}</span>
              </span>
              {s ? (
                <Badge tone={s.group_id === g.id ? 'brand' : 'warning'}>
                  {s.group_id === g.id ? `${s.studied}/${s.total} estudados` : 'tem mentoria individual'}
                </Badge>
              ) : (
                <Badge>ainda não entrou</Badge>
              )}
              <ChevronRight className="size-4 text-muted" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
