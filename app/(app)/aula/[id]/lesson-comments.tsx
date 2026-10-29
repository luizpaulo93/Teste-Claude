'use client';

import { confirmDialog } from '@/components/confirm';

import { MessageSquare, Send, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/components/toast';
import { Avatar, Card } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import { addComment, deleteComment, moreComments } from './actions';
import type { LessonComment, ProfileCard } from '@/lib/types';
import { timeAgo } from '@/lib/utils';

export function LessonComments({
  lessonId,
  initial,
  me,
  isAdmin,
}: {
  lessonId: string;
  initial: LessonComment[];
  me: ProfileCard;
  isAdmin: boolean;
}) {
  const [list, setList] = useState(initial);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(initial.length >= 30);
  const [loadingMore, setLoadingMore] = useState(false);

  async function loadMore() {
    const last = list.at(-1);
    if (!last) return;
    setLoadingMore(true);
    const more = await moreComments(lessonId, last.created_at).catch(() => []);
    setLoadingMore(false);
    setHasMore(more.length >= 30);
    setList((l) => [...l, ...more.filter((m) => !l.some((x) => x.id === m.id))]);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    const r = await addComment(lessonId, body);
    setSending(false);
    if (r.error || !r.comment) return toast.error(r.error || 'Não foi possível enviar o comentário.');
    setList((l) => [r.comment!, ...l]);
    setText('');
  }

  async function remove(id: string) {
    if (!(await confirmDialog('Excluir este comentário?'))) return;
    const r = await deleteComment(lessonId, id);
    if (r.error) toast.error(r.error);
    else setList((l) => l.filter((c) => c.id !== id));
  }

  return (
    <Card className="p-4 sm:p-5">
      <p className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
        <MessageSquare className="size-4 text-brand" /> Comentários <span className="font-medium text-muted">({list.length})</span>
      </p>
      <form onSubmit={send} className="mb-5 flex items-center gap-2 rounded-2xl border border-line-strong bg-bg-elev p-1.5 pl-2 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
        <Avatar name={me.full_name} src={me.avatar_url} size={30} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          placeholder="Envie sua mensagem…"
          className="min-w-0 flex-1 bg-transparent px-1 text-sm text-ink placeholder:text-muted/70 focus:outline-none"
        />
        <button type="submit" disabled={sending || !text.trim()} aria-label="Enviar" className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-white transition hover:bg-brand-strong disabled:opacity-40">
          {sending ? <Spinner /> : <Send className="size-4" />}
        </button>
      </form>
      {list.length ? (
        <ul className="space-y-4">
          {list.map((c) => {
            const name = c.author_name || 'Aluno';
            return (
              <li key={c.id} className="flex animate-fade-in gap-3">
                <Avatar name={name} src={c.author_avatar} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{name}</span>
                    {c.author_role === 'admin' && <ShieldCheck className="size-3.5 text-brand" />}
                    <span className="text-[11px] text-muted">{timeAgo(c.created_at)}</span>
                    {(c.author_id === me.id || isAdmin) && (
                      <button type="button" onClick={() => remove(c.id)} aria-label="Excluir" className="ml-auto text-muted hover:text-danger">
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm break-words whitespace-pre-line text-ink-2">{c.text}</p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {list.length > 0 && hasMore && (
        <button type="button" onClick={loadMore} disabled={loadingMore} className="mt-4 w-full rounded-xl py-2 text-sm font-semibold text-brand hover:bg-brand-soft">
          {loadingMore ? 'Carregando…' : 'Ver comentários anteriores'}
        </button>
      )}
      {list.length ? null : (
        <p className="text-sm text-muted">Seja o primeiro a comentar esta aula.</p>
      )}
    </Card>
  );
}
