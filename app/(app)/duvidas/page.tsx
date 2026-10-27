import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { requireViewer } from '@/lib/session';
import { db, fromQuery } from '@/lib/db';
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
  // "Todas" usa a ordem do banco; os filtros usam um campo só (não exigem índices extras) e ordenam aqui
  const col = db().collection('doubts');
  let rows: Doubt[];
  if (f === 'todas') rows = fromQuery<Doubt>(await col.orderBy('created_at', 'desc').limit(limit + 1).get());
  else {
    const q = f === 'minhas' ? col.where('author_id', '==', viewer.userId) : col.where('is_resolved', '==', f === 'resolvidas');
    rows = fromQuery<Doubt>(await q.limit(300).get())
      .filter((d) => f !== 'abertas' || d.replies_count === 0)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const hasMore = rows.length > limit;
  const doubts = rows.slice(0, limit);
  const likeSnaps = doubts.length ? await db().getAll(...doubts.map((d) => db().doc(`doubts/${d.id}/likes/${viewer.userId}`))) : [];
  const likedIds = likeSnaps.filter((s) => s.exists).map((s) => s.ref.parent.parent!.id);

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
