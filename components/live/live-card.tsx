import { CalendarClock, PlayCircle, Radio } from 'lucide-react';
import Link from 'next/link';
import { SafeImg } from '@/components/safe-img';
import type { LiveSession } from '@/lib/types';
import { cn, formatDateTime, youtubeThumb } from '@/lib/utils';

/** Cartão vertical de aulão (estilo "AO VIVO — DIA 1"). */
export function LiveCard({ live, className }: { live: LiveSession; className?: string }) {
  const img = live.cover_url || (live.status !== 'scheduled' && live.youtube_id ? youtubeThumb(live.youtube_id) : '');
  return (
    <Link href={`/ao-vivo/${live.id}`} className={cn('group block', className)}>
      <div
        className={cn(
          'relative aspect-[3/4] overflow-hidden rounded-2xl border bg-surface-2 transition-all duration-300 group-hover:-translate-y-1',
          live.status === 'live' ? 'border-red-500/60 shadow-[0_0_30px_-6px_rgba(239,68,68,0.6)]' : 'border-line group-hover:shadow-glow',
        )}
      >
        <div className={cn('absolute inset-0 bg-gradient-to-b', live.status === 'live' ? 'from-red-600 to-rose-900' : 'from-blue-600 to-indigo-900')} />
        {img && <SafeImg src={img} className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
        <div className="absolute top-2.5 left-2.5">
          {live.status === 'live' ? (
            <span className="flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-1 text-[10px] font-bold text-white">
              <span className="size-1.5 animate-pulse rounded-full bg-white" /> AO VIVO
            </span>
          ) : live.status === 'scheduled' ? (
            <span className="flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
              <CalendarClock className="size-3" /> EM BREVE
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
              <PlayCircle className="size-3" /> GRAVAÇÃO
            </span>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="line-clamp-3 text-sm leading-tight font-extrabold text-white">{live.title}</p>
          <p className="mt-1 flex items-center gap-1 text-[11px] text-white/70">
            {live.status === 'live' ? <Radio className="size-3" /> : <CalendarClock className="size-3" />}
            {live.status === 'live' ? 'Acontecendo agora' : formatDateTime(live.starts_at)}
          </p>
        </div>
      </div>
    </Link>
  );
}
