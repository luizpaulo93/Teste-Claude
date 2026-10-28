import { isDocId } from '@/lib/utils';
import { CalendarClock, ChevronLeft, Lock, Radio } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card } from '@/components/ui';
import { requireViewer } from '@/lib/session';
import { sql } from '@/lib/db';
import { canSeeLive } from '@/lib/live';
import type { LiveMessage, LiveSession } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import { LiveRoom } from './live-room';

export const metadata: Metadata = { title: 'Ao vivo' };

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isDocId(id)) notFound();
  const viewer = await requireViewer();
  const live = await sql.one<LiveSession>(`select * from live_sessions where id = $1`, [id]);
  if (!live || !(await canSeeLive(viewer, live))) {
    return (
      <Card className="mx-auto mt-10 flex max-w-md flex-col items-center p-10 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
          <Lock className="size-6" />
        </div>
        <p className="mt-4 text-lg font-bold text-ink">Transmissão exclusiva</p>
        <p className="mt-1 text-sm text-muted">Esta aula ao vivo é só para alunos com a turma liberada.</p>
        <Link href="/ao-vivo" className="mt-5 text-sm font-semibold text-brand">
          Ver transmissões
        </Link>
      </Card>
    );
  }
  const messages = (
    await sql.query<LiveMessage>(`select * from live_messages where live_id = $1 order by created_at desc limit 80`, [id])
  ).reverse();

  return (
    <>
      <Link href="/ao-vivo" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Ao vivo
      </Link>
      <LiveRoom
        live={{ ...live, youtube_id: live.status === 'ended' && !live.show_replay ? '' : live.youtube_id }}
        messages={messages}
        me={{ id: viewer.userId, full_name: viewer.profile.full_name || viewer.email, avatar_url: viewer.profile.avatar_url, role: viewer.profile.role }}
        isAdmin={viewer.isAdmin}
        watermark={`${viewer.profile.full_name || ''} · ${viewer.email}`.trim()}
        serverNow={Date.now()}
        scheduledLabel={formatDateTime(live.starts_at)}
        icons={{ scheduled: <CalendarClock className="size-7" />, live: <Radio className="size-4" /> }}
      />
    </>
  );
}
