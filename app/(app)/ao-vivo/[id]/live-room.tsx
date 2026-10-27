'use client';

import { Send, ShieldCheck, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { VideoPlayer } from '@/components/player/video-player';
import { toast } from '@/components/toast';
import { Avatar, Card } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import { createClient } from '@/lib/supabase/client';
import type { LiveMessage, LiveSession, ProfileCard } from '@/lib/types';
import { cn, youtubeThumb } from '@/lib/utils';

export function LiveRoom({
  live,
  messages,
  authors,
  me,
  isAdmin,
  watermark,
  serverNow,
  scheduledLabel,
  icons,
}: {
  live: LiveSession;
  messages: LiveMessage[];
  authors: ProfileCard[];
  me: ProfileCard;
  isAdmin: boolean;
  watermark: string;
  serverNow: number;
  scheduledLabel: string;
  icons: { scheduled: ReactNode; live: ReactNode };
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // Verifica a cada 20 s se a transmissão começou/terminou (sem recarregar a página toda)
  useEffect(() => {
    if (live.status === 'ended') return;
    const t = window.setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      const { data } = await supabase.from('live_sessions').select('status').eq('id', live.id).maybeSingle();
      if (data && data.status !== live.status) router.refresh();
    }, 20000);
    return () => window.clearInterval(t);
  }, [live.id, live.status, supabase, router]);

  const showChat = live.chat_enabled || messages.length > 0;

  return (
    <div className={cn('grid gap-5', showChat && 'lg:grid-cols-[minmax(0,1fr)_360px]')}>
      <div className="min-w-0 space-y-4">
        <div className="-mx-4 sm:mx-0">
          {live.status === 'scheduled' ? (
            <Countdown startsAt={live.starts_at} serverNow={serverNow} label={scheduledLabel} icon={icons.scheduled} cover={live.cover_url} />
          ) : live.youtube_id ? (
            <VideoPlayer key={live.status} videoId={live.youtube_id} live={live.status === 'live'} poster={live.cover_url || youtubeThumb(live.youtube_id)} watermark={watermark} />
          ) : (
            <div className="grid aspect-video place-items-center bg-surface-2 text-center sm:rounded-2xl">
              <p className="px-6 text-sm text-muted">Transmissão encerrada. A gravação não está disponível.</p>
            </div>
          )}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {live.status === 'live' && (
              <span className="flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">
                {icons.live} AO VIVO
              </span>
            )}
            {live.status === 'ended' && <span className="rounded-md bg-surface-3 px-2 py-0.5 text-[11px] font-bold text-ink-2">GRAVAÇÃO</span>}
          </div>
          <h1 className="mt-2 text-xl font-extrabold tracking-tight text-ink sm:text-2xl">{live.title}</h1>
          {live.description && <p className="mt-2 text-sm whitespace-pre-line text-ink-2">{live.description}</p>}
        </div>
      </div>
      {showChat && (
        <LiveChat liveId={live.id} initial={messages} authors={authors} me={me} isAdmin={isAdmin} canSend={live.chat_enabled && live.status !== 'ended'} isLive={live.status === 'live'} />
      )}
    </div>
  );
}

function Countdown({ startsAt, serverNow, label, icon, cover }: { startsAt: string; serverNow: number; label: string; icon: ReactNode; cover: string }) {
  const offset = useRef(serverNow - Date.now());
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => window.clearInterval(t);
  }, []);
  const diff = Math.max(0, new Date(startsAt).getTime() - now);
  const parts = [
    [Math.floor(diff / 86400000), 'dias'],
    [Math.floor((diff % 86400000) / 3600000), 'horas'],
    [Math.floor((diff % 3600000) / 60000), 'min'],
    [Math.floor((diff % 60000) / 1000), 'seg'],
  ] as const;
  return (
    <div className="relative grid aspect-video place-items-center overflow-hidden bg-surface-2 sm:rounded-2xl">
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt="" className="absolute inset-0 size-full object-cover opacity-40" />
      ) : (
        <div className="hero-fallback absolute inset-0 opacity-80" />
      )}
      <div className="relative px-4 text-center text-white">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-white/10 backdrop-blur">{icon}</div>
        <p className="mt-3 text-sm font-semibold text-white/80">{diff > 0 ? `Começa em ${label}` : 'Aguardando o professor iniciar…'}</p>
        {diff > 0 && (
          <div className="mt-4 flex justify-center gap-2 sm:gap-3">
            {parts.map(([v, l]) => (
              <div key={l} className="min-w-14 rounded-xl bg-black/40 px-2 py-2 backdrop-blur sm:min-w-16">
                <p className="text-2xl font-black tabular-nums sm:text-3xl">{String(v).padStart(2, '0')}</p>
                <p className="text-[10px] tracking-wide text-white/60 uppercase">{l}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LiveChat({
  liveId,
  initial,
  authors,
  me,
  isAdmin,
  canSend,
  isLive,
}: {
  liveId: string;
  initial: LiveMessage[];
  authors: ProfileCard[];
  me: ProfileCard;
  isAdmin: boolean;
  canSend: boolean;
  isLive: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [list, setList] = useState(initial);
  const [cards, setCards] = useState(() => new Map([...authors, me].map((a) => [a.id, a])));
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const lastId = useRef(initial.at(-1)?.id ?? 0);
  const stick = useRef(true);

  // Busca novas mensagens a cada 4 s só durante a live e com a aba visível (leve para o servidor)
  useEffect(() => {
    if (!isLive) return;
    let busy = false;
    const poll = async () => {
      if (busy || document.visibilityState !== 'visible') return;
      busy = true;
      const { data } = await supabase.from('live_messages').select('*').eq('live_id', liveId).gt('id', lastId.current).order('id').limit(100);
      busy = false;
      const fresh = (data ?? []) as LiveMessage[];
      if (!fresh.length) return;
      lastId.current = fresh.at(-1)!.id;
      const missing = [...new Set(fresh.map((m) => m.author_id))].filter((id) => !cards.has(id));
      if (missing.length) {
        const { data: c } = await supabase.from('profile_cards').select('*').in('id', missing);
        setCards((m) => new Map([...m, ...((c ?? []) as ProfileCard[]).map((x) => [x.id, x] as const)]));
      }
      setList((l) => {
        const seen = new Set(l.map((x) => x.id));
        return [...l, ...fresh.filter((x) => !seen.has(x.id))].slice(-300);
      });
    };
    const t = window.setInterval(poll, 4000);
    return () => window.clearInterval(t);
  }, [isLive, liveId, supabase, cards]);

  useEffect(() => {
    const el = boxRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [list]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    const { data, error } = await supabase.from('live_messages').insert({ live_id: liveId, author_id: me.id, text: body.slice(0, 500) }).select('*').single();
    setSending(false);
    if (error || !data) return toast.error('Não foi possível enviar.');
    stick.current = true;
    lastId.current = Math.max(lastId.current, (data as LiveMessage).id);
    setList((l) => [...l, data as LiveMessage]);
    setText('');
  }

  async function remove(id: number) {
    const { error } = await supabase.from('live_messages').delete().eq('id', id);
    if (!error) setList((l) => l.filter((m) => m.id !== id));
  }

  return (
    <Card className="flex h-[60dvh] flex-col overflow-hidden lg:sticky lg:top-6 lg:h-[calc(100dvh-120px)]">
      <div className="border-b border-line px-4 py-3">
        <p className="text-sm font-bold text-ink">Chat da aula</p>
        <p className="text-xs text-muted">{isLive ? 'Converse com a turma em tempo real' : 'Mensagens da transmissão'}</p>
      </div>
      <div
        ref={boxRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
        className="scrollbar-thin flex-1 space-y-3 overflow-y-auto px-4 py-3"
      >
        {!list.length && <p className="pt-6 text-center text-sm text-muted">Nenhuma mensagem ainda. Diga oi! 👋</p>}
        {list.map((m) => {
          const a = cards.get(m.author_id);
          const admin = a?.role === 'admin';
          return (
            <div key={m.id} className="group flex animate-fade-in gap-2.5">
              <Avatar name={a?.full_name || 'Aluno'} src={a?.avatar_url} size={26} />
              <div className="min-w-0 flex-1 text-sm">
                <span className={cn('mr-1.5 font-semibold', admin ? 'text-brand' : 'text-ink')}>
                  {a?.full_name || 'Aluno'}
                  {admin && <ShieldCheck className="ml-1 inline size-3.5" />}
                </span>
                <span className="break-words text-ink-2">{m.text}</span>
              </div>
              {(m.author_id === me.id || isAdmin) && (
                <button type="button" onClick={() => remove(m.id)} aria-label="Excluir" className="self-start text-muted opacity-0 transition group-hover:opacity-100 hover:text-danger">
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {canSend ? (
        <form onSubmit={send} className="flex items-center gap-2 border-t border-line p-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            placeholder="Envie sua mensagem…"
            className="h-10 min-w-0 flex-1 rounded-xl border border-line-strong bg-bg-elev px-3 text-sm text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none"
          />
          <button type="submit" disabled={sending || !text.trim()} aria-label="Enviar" className="grid size-10 place-items-center rounded-xl bg-brand text-white disabled:opacity-40">
            {sending ? <Spinner /> : <Send className="size-4" />}
          </button>
        </form>
      ) : (
        <p className="border-t border-line p-3 text-center text-xs text-muted">Chat encerrado</p>
      )}
    </Card>
  );
}
