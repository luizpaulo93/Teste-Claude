'use client';

import { Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from '@/components/toast';
import { buttonClass, Textarea } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import { markRead, sendMessage } from '@/app/(app)/mentoria/actions';
import type { MentoriaMessage } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';

/** Conversa aluno ↔ mentor. Atualiza sozinha a cada 15 s. */
export function MentoriaChat({ messages, asMentor, mentoriaId }: { messages: MentoriaMessage[]; asMentor: boolean; mentoriaId?: string }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void markRead(mentoriaId);
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, mentoriaId]);
  useEffect(() => {
    const t = window.setInterval(() => document.visibilityState === 'visible' && router.refresh(), 15000);
    return () => window.clearInterval(t);
  }, [router]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    const r = await sendMessage(text, mentoriaId);
    setBusy(false);
    if (r.error) return toast.error(r.error);
    setText('');
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="scrollbar-thin max-h-[60dvh] min-h-48 space-y-2 overflow-y-auto rounded-2xl border border-line bg-surface-2/40 p-3">
        {messages.length ? (
          messages.map((m) => {
            const mine = m.from_mentor === asMentor;
            return (
              <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[85%] rounded-2xl px-3.5 py-2 text-sm', mine ? 'rounded-br-md bg-brand text-white' : 'rounded-bl-md border border-line bg-surface text-ink')}>
                  {!mine && <p className="text-[11px] font-bold text-brand">{m.from_mentor ? 'Mentor' : m.author_name}</p>}
                  <p className="whitespace-pre-line break-words">{m.text}</p>
                  <p className={cn('mt-1 text-right text-[10px]', mine ? 'text-white/70' : 'text-muted')}>{formatDateTime(m.created_at)}</p>
                </div>
              </div>
            );
          })
        ) : (
          <p className="py-10 text-center text-sm text-muted">{asMentor ? 'Mande a primeira mensagem para o aluno.' : 'Tire dúvidas e fale com seu mentor por aqui.'}</p>
        )}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(min-width: 640px)').matches) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          maxLength={3000}
          placeholder="Escreva sua mensagem…"
          className="min-w-0 flex-1"
        />
        <button type="submit" disabled={busy || !text.trim()} aria-label="Enviar" className={buttonClass('primary', 'icon', 'size-11 shrink-0')}>
          {busy ? <Spinner /> : <Send className="size-4" />}
        </button>
      </form>
    </div>
  );
}
