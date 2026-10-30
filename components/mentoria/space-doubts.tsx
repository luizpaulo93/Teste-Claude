import Link from 'next/link';
import { DoubtComposer } from '@/app/(app)/duvidas/doubt-composer';
import { DoubtFeed } from '@/app/(app)/duvidas/doubt-feed';
import { sql } from '@/lib/db';
import type { Viewer } from '@/lib/session';
import type { Doubt } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Dúvidas de um espaço da mentoria (fotos, comentários e curtidas, como nas dúvidas da plataforma). */
export async function SpaceDoubts({ viewer, space, spaces, base }: { viewer: Viewer; space: string; spaces?: { key: string; label: string; pending?: number }[]; base?: string }) {
  const rows = await sql.query<Doubt & { liked: boolean }>(
    `select d.*, exists(select 1 from doubt_likes l where l.doubt_id = d.id and l.user_id = $2) as liked
       from doubts d where d.space = $1 order by d.created_at desc limit 100`,
    [space, viewer.userId],
  );
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {spaces && spaces.length > 1 && (
        <div className="rail -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {spaces.map((s) => (
            <Link
              key={s.key}
              href={`${base}?s=${encodeURIComponent(s.key)}`}
              scroll={false}
              className={cn('shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition', s.key === space ? 'border-brand bg-brand text-white' : 'border-line-strong text-ink-2 hover:bg-surface-2')}
            >
              {s.label}
            </Link>
          ))}
        </div>
      )}
      <DoubtComposer userId={viewer.userId} name={viewer.profile.full_name || viewer.email} avatar={viewer.profile.avatar_url} space={space} />
      <DoubtFeed key={space + rows.length} doubts={rows} likedIds={rows.filter((d) => d.liked).map((d) => d.id)} viewerId={viewer.userId} isAdmin={viewer.isAdmin} />
    </div>
  );
}
