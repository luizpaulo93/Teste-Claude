import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { requireViewer } from '@/lib/session';
import { sql } from '@/lib/db';
import type { Doubt } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DoubtComposer } from './doubt-composer';
import { DoubtFeed } from './doubt-feed';

export const metadata: Metadata = { title: 'Dúvidas' };

const FILTERS = [
  { key: 'todas', label: 'Todas' },
  { key: 'abertas', label: 'Sem resposta' },
  { key: 'resolvidas', label: 'Resolvidas' },
  { key: 'minhas', label: 'Minhas' },
];

export default async function DoubtsPage({ searchParams }: { searchParams: Promise<{ f?: string; n?: string }> }) {
  const viewer = await requireViewer();
  if (!viewer.isMember) redirect('/');
  const { f = 'todas', n } = await searchParams;
  const limit = Math.min(200, Math.max(20, Number(n) || 20));
  const where =
    f === 'minhas' ? 'author_id = $2' : f === 'resolvidas' ? 'is_resolved' : f === 'abertas' ? 'not is_resolved and replies_count = 0' : 'true';
  const rows = await sql.query<Doubt & { liked: boolean }>(
    `select d.*, exists(select 1 from doubt_likes l where l.doubt_id = d.id and l.user_id = $2) as liked
       from doubts d where ${where} order by created_at desc limit $1`,
    [limit + 1, viewer.userId],
  );
  const hasMore = rows.length > limit;
  const doubts = rows.slice(0, limit);
  const likedIds = doubts.filter((d) => d.liked).map((d) => d.id);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Comunidade" title="Dúvidas" subtitle="Pergunte, ajude colegas e tire dúvidas com os professores." />
      <DoubtComposer userId={viewer.userId} name={viewer.profile.full_name || viewer.email} avatar={viewer.profile.avatar_url} />
      <div className="rail -mx-4 my-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {FILTERS.map((x) => (
          <Link
            key={x.key}
            href={`/duvidas?f=${x.key}`}
            scroll={false}
            className={cn(
              'shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition',
              f === x.key ? 'border-brand bg-brand text-white' : 'border-line-strong text-ink-2 hover:bg-surface-2',
            )}
          >
            {x.label}
          </Link>
        ))}
      </div>
      <DoubtFeed
        key={`${f}-${limit}`}
        doubts={doubts}
        likedIds={likedIds}
        viewerId={viewer.userId}
        isAdmin={viewer.isAdmin}
      />
      {hasMore && (
        <div className="mt-6 text-center">
          <Link href={`/duvidas?f=${f}&n=${limit + 20}`} scroll={false} className="text-sm font-semibold text-brand">
            Carregar mais
          </Link>
        </div>
      )}
    </div>
  );
}
