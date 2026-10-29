import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import type { LiveSession } from '@/lib/types';
import { isDocId } from '@/lib/utils';
import { getAccount, oauthConfigured } from '@/lib/youtube';
import { Studio } from './studio';

export const metadata: Metadata = { title: 'Estúdio · Ao vivo' };

export default async function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isDocId(id)) notFound();
  const [live, acc] = await Promise.all([sql.one<LiveSession>(`select * from live_sessions where id = $1`, [id]), getAccount()]);
  if (!live) notFound();
  const connected = oauthConfigured() && Boolean(acc.refresh_token);
  const ready = connected || (Boolean(acc.stream_key) && Boolean(live.youtube_id));
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
          ready
            ? connected
              ? `Vai transmitir no canal ${acc.channel_title || 'conectado'} como não listado.`
              : 'Vai transmitir pela chave salva para a live do link desta transmissão.'
            : connected || acc.stream_key
              ? 'Cole o link da live do YouTube nesta transmissão (Editar) para usar a chave salva.'
              : 'Conecte a conta do YouTube ou salve a chave da transmissão na tela Ao vivo.'
        }
      />
    </div>
  );
}
