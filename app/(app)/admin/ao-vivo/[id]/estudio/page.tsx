import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import { LiveMaterialsAdmin } from '@/components/live/live-materials';
import { requireViewer } from '@/lib/session';
import type { LiveMessage, LiveSession } from '@/lib/types';
import { LiveChat } from '../../../../ao-vivo/[id]/live-room';
import { isDocId } from '@/lib/utils';
import { getAccount, oauthConfigured } from '@/lib/youtube';
import { Studio } from './studio';

export const metadata: Metadata = { title: 'Estúdio · Ao vivo' };

export default async function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isDocId(id)) notFound();
  const [live, acc] = await Promise.all([sql.one<LiveSession>(`select * from live_sessions where id = $1`, [id]), getAccount()]);
  if (!live) notFound();
  const viewer = await requireViewer();
  const messages = (await sql.query<LiveMessage>(`select * from live_messages where live_id = $1 order by created_at desc limit 80`, [id])).reverse();
  const connected = oauthConfigured() && Boolean(acc.refresh_token);
  const ready = connected;
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link href="/admin/ao-vivo" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Ao vivo
      </Link>
      <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">{live.title}</h1>
      <Studio
        liveId={live.id}
        live={live.status === 'live'}
        ready={ready}
        hint={
          connected
            ? `Transmite no canal ${acc.channel_title || 'conectado'} (não listado). Ao encerrar, o link vira aula na pasta “Lives”.`
            : 'Conecte a conta do YouTube na tela Ao vivo para transmitir.'
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-2 rounded-2xl border border-line bg-surface p-4">
          <LiveMaterialsAdmin liveId={live.id} materials={live.materials ?? []} />
          <p className="text-[11px] text-muted">Suba o PDF durante a live: ele aparece na hora para os alunos e fica salvo na aula depois.</p>
        </div>
        <LiveChat
          liveId={live.id}
          initial={messages}
          me={{ id: viewer.userId, full_name: viewer.profile.full_name || viewer.email, avatar_url: viewer.profile.avatar_url, role: viewer.profile.role }}
          isAdmin
          canSend={live.status !== 'ended'}
          isLive={live.status !== 'ended'}
        />
      </div>
    </div>
  );
}
