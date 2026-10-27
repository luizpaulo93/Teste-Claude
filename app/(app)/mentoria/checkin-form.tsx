'use client';

import { MessageSquareQuote, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from '@/components/toast';
import { buttonClass, Field, Input, Textarea } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import { createClient } from '@/lib/supabase/client';
import type { MentoriaCheckin } from '@/lib/types';
import { cn } from '@/lib/utils';

export function CheckinForm({ mentoriaId, week, checkin }: { mentoriaId: string; week: string; checkin: MentoriaCheckin | null }) {
  const router = useRouter();
  const [hours, setHours] = useState(String(checkin?.hours_studied ?? ''));
  const [questions, setQuestions] = useState(String(checkin?.questions_done ?? ''));
  const [focus, setFocus] = useState(checkin?.focus_rating ?? 3);
  const [wins, setWins] = useState(checkin?.wins ?? '');
  const [diff, setDiff] = useState(checkin?.difficulties ?? '');
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      hours_studied: Math.min(168, Math.max(0, Number(hours) || 0)),
      questions_done: Math.min(5000, Math.max(0, Math.round(Number(questions) || 0))),
      focus_rating: focus,
      wins: wins.slice(0, 1500),
      difficulties: diff.slice(0, 1500),
    };
    const supabase = createClient();
    const { error } = checkin
      ? await supabase.from('mentoria_checkins').update(payload).eq('id', checkin.id)
      : await supabase.from('mentoria_checkins').insert({ ...payload, mentoria_id: mentoriaId, week_start: week });
    setSaving(false);
    if (error) return toast.error('Não foi possível salvar o check-in.');
    toast('Check-in salvo!');
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {checkin?.mentor_feedback && (
        <div className="rounded-xl border border-brand/25 bg-brand-soft p-4">
          <p className="flex items-center gap-2 text-xs font-bold text-brand">
            <MessageSquareQuote className="size-4" /> Feedback do mentor
          </p>
          <p className="mt-2 text-sm whitespace-pre-line text-ink">{checkin.mentor_feedback}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Horas estudadas">
          <Input type="number" inputMode="decimal" min={0} max={168} step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Questões feitas">
          <Input type="number" inputMode="numeric" min={0} max={5000} value={questions} onChange={(e) => setQuestions(e.target.value)} placeholder="0" />
        </Field>
      </div>
      <div>
        <span className="text-xs font-semibold text-ink-2">Nível de foco</span>
        <div className="mt-1.5 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setFocus(n)} aria-label={`Foco ${n}`} className="p-1">
              <Star className={cn('size-7 transition', n <= focus ? 'fill-warning text-warning' : 'text-line-strong')} />
            </button>
          ))}
        </div>
      </div>
      <Field label="O que deu certo">
        <Textarea value={wins} onChange={(e) => setWins(e.target.value)} maxLength={1500} rows={3} />
      </Field>
      <Field label="Dificuldades">
        <Textarea value={diff} onChange={(e) => setDiff(e.target.value)} maxLength={1500} rows={3} />
      </Field>
      <button type="submit" disabled={saving} className={buttonClass('primary', 'md', 'w-full sm:w-auto')}>
        {saving && <Spinner />} {checkin ? 'Atualizar check-in' : 'Enviar check-in'}
      </button>
    </form>
  );
}
