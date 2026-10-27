'use client';

import { CheckCircle2, Heart, MessageCircle, MessageCircleQuestion, ShieldCheck, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from '@/components/toast';
import { Avatar, Badge, Card, EmptyState } from '@/components/ui';
import { Modal, Spinner } from '@/components/ui-client';
import { createClient } from '@/lib/supabase/client';
import type { Doubt, DoubtReply, ProfileCard } from '@/lib/types';
import { cn, timeAgo } from '@/lib/utils';
import { DoubtComposer } from './doubt-composer';

export function DoubtFeed({
  doubts,
  authors,
  likedIds,
  viewerId,
  isAdmin,
}: {
  doubts: Doubt[];
  authors: ProfileCard[];
  likedIds: string[];
  viewerId: string;
  isAdmin: boolean;
}) {
  const [cards, setCards] = useState(() => new Map(authors.map((a) => [a.id, a])));
  const liked = useMemo(() => new Set(likedIds), [likedIds]);
  const [zoom, setZoom] = useState('');

  if (!doubts.length)
    return <EmptyState icon={<MessageCircleQuestion className="size-6" />} title="Nenhuma dúvida por aqui" description="Seja o primeiro a perguntar!" />;

  return (
    <div className="space-y-4">
      {doubts.map((d) => (
        <DoubtCard
          key={d.id}
          doubt={d}
          author={cards.get(d.author_id)}
          cards={cards}
          addCards={(list) => setCards((m) => new Map([...m, ...list.map((c) => [c.id, c] as const)]))}
          initiallyLiked={liked.has(d.id)}
          viewerId={viewerId}
          isAdmin={isAdmin}
          onZoom={setZoom}
        />
      ))}
      <Modal open={Boolean(zoom)} onClose={() => setZoom('')} size="xl" title="Imagem">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {zoom && <img src={zoom} alt="" className="mx-auto max-h-[75dvh] rounded-xl" />}
      </Modal>
    </div>
  );
}

function DoubtCard({
  doubt,
  author,
  cards,
  addCards,
  initiallyLiked,
  viewerId,
  isAdmin,
  onZoom,
}: {
  doubt: Doubt;
  author?: ProfileCard;
  cards: Map<string, ProfileCard>;
  addCards: (c: ProfileCard[]) => void;
  initiallyLiked: boolean;
  viewerId: string;
  isAdmin: boolean;
  onZoom: (url: string) => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [liked, setLiked] = useState(initiallyLiked);
  const [likes, setLikes] = useState(doubt.likes_count);
  const [resolved, setResolved] = useState(doubt.is_resolved);
  const [open, setOpen] = useState(false);
  const [replies, setReplies] = useState<DoubtReply[] | null>(null);
  const [loading, setLoading] = useState(false);
  const canManage = doubt.author_id === viewerId || isAdmin;

  const loadReplies = async () => {
    setLoading(true);
    const { data } = await supabase.from('doubt_replies').select('*').eq('doubt_id', doubt.id).order('created_at').limit(200);
    const list = (data ?? []) as DoubtReply[];
    const missing = [...new Set(list.map((r) => r.author_id))].filter((id) => !cards.has(id));
    if (missing.length) {
      const { data: c } = await supabase.from('profile_cards').select('*').in('id', missing);
      addCards((c ?? []) as ProfileCard[]);
    }
    setReplies(list);
    setLoading(false);
  };

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && replies === null) void loadReplies();
  };

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    const { error } = next
      ? await supabase.from('doubt_likes').insert({ doubt_id: doubt.id, user_id: viewerId })
      : await supabase.from('doubt_likes').delete().eq('doubt_id', doubt.id).eq('user_id', viewerId);
    if (error) {
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
    }
  };

  const toggleResolved = async () => {
    const next = !resolved;
    setResolved(next);
    const { error } = await supabase.from('doubts').update({ is_resolved: next }).eq('id', doubt.id);
    if (error) {
      setResolved(!next);
      toast.error('Não foi possível atualizar.');
    } else toast(next ? 'Marcada como resolvida' : 'Reaberta');
  };

  const remove = async () => {
    if (!window.confirm('Excluir esta dúvida e todas as respostas?')) return;
    const { error } = await supabase.from('doubts').delete().eq('id', doubt.id);
    if (error) toast.error('Não foi possível excluir.');
    else {
      toast('Dúvida excluída');
      router.refresh();
    }
  };

  const removeReply = async (id: string) => {
    if (!window.confirm('Excluir esta resposta?')) return;
    const { error } = await supabase.from('doubt_replies').delete().eq('id', id);
    if (!error) setReplies((r) => r?.filter((x) => x.id !== id) ?? null);
  };

  const name = author?.full_name || 'Aluno';

  return (
    <Card className={cn('cv-auto overflow-hidden transition-colors', resolved && 'border-success/30')}>
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Avatar name={name} src={author?.avatar_url} size={40} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-bold text-ink">{name}</span>
              {author?.role === 'admin' && (
                <Badge tone="brand">
                  <ShieldCheck className="size-3" /> Professor
                </Badge>
              )}
              <span className="text-xs text-muted">{timeAgo(doubt.created_at)}</span>
              {resolved && (
                <Badge tone="success">
                  <CheckCircle2 className="size-3" /> Resolvida
                </Badge>
              )}
            </div>
            <p className="mt-2 text-sm leading-relaxed break-words whitespace-pre-line text-ink-2">{doubt.text}</p>
            {doubt.image_url && (
              <button type="button" onClick={() => onZoom(doubt.image_url)} className="mt-3 block overflow-hidden rounded-xl border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={doubt.image_url} alt="" loading="lazy" className="max-h-80 w-auto object-contain" />
              </button>
            )}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1 border-t border-line pt-3">
          <button
            type="button"
            onClick={toggleLike}
            className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:bg-surface-2', liked ? 'text-danger' : 'text-muted')}
          >
            <Heart className={cn('size-4', liked && 'fill-current')} /> {likes}
          </button>
          <button type="button" onClick={toggleOpen} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-surface-2">
            <MessageCircle className="size-4" /> {(() => {
              const n = replies?.length ?? doubt.replies_count;
              return open ? `${n} · ocultar` : n === 0 ? 'Responder' : `${n} resposta${n === 1 ? '' : 's'}`;
            })()}
          </button>
          <div className="flex-1" />
          {canManage && (
            <>
              <button
                type="button"
                onClick={toggleResolved}
                className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:bg-surface-2', resolved ? 'text-muted' : 'text-success')}
              >
                {resolved ? 'Reabrir' : 'Resolvida'}
              </button>
              <button type="button" onClick={remove} aria-label="Excluir" className="rounded-lg p-2 text-muted transition hover:bg-danger/10 hover:text-danger">
                <Trash2 className="size-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {open && (
        <div className="animate-fade-in border-t border-line bg-surface-2/40 p-4 sm:p-5">
          {loading && (
            <div className="flex justify-center py-4">
              <Spinner className="text-brand" />
            </div>
          )}
          {replies && (
            <ul className="mb-4 space-y-4">
              {replies.map((r) => {
                const c = cards.get(r.author_id);
                return (
                  <li key={r.id} className="flex gap-3">
                    <Avatar name={c?.full_name || 'Aluno'} src={c?.avatar_url} size={32} />
                    <div className={cn('min-w-0 flex-1 rounded-2xl rounded-tl-sm px-3.5 py-2.5', c?.role === 'admin' ? 'bg-brand-soft' : 'bg-surface')}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-ink">{c?.full_name || 'Aluno'}</span>
                        {c?.role === 'admin' && <ShieldCheck className="size-3.5 text-brand" />}
                        <span className="text-[11px] text-muted">{timeAgo(r.created_at)}</span>
                        {(r.author_id === viewerId || isAdmin) && (
                          <button type="button" onClick={() => removeReply(r.id)} aria-label="Excluir resposta" className="ml-auto text-muted hover:text-danger">
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="mt-1 text-sm break-words whitespace-pre-line text-ink-2">{r.text}</p>
                      {r.image_url && (
                        <button type="button" onClick={() => onZoom(r.image_url)} className="mt-2 block overflow-hidden rounded-lg border border-line">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={r.image_url} alt="" loading="lazy" className="max-h-60 w-auto" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <DoubtComposer userId={viewerId} name="" avatar="" doubtId={doubt.id} compact onDone={loadReplies} />
        </div>
      )}
    </Card>
  );
}
