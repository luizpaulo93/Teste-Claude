import { ChevronLeft, ChevronRight, MessageSquareQuote } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { WeekPlan } from '@/components/mentoria/week-plan';
import { buttonClass, Card } from '@/components/ui';
import { emailKey } from '@/lib/db';
import { todayBR } from '@/lib/mentoria';
import { checkins, getMentoria, weekTasks } from '@/lib/mentoria-data';
import { requireViewer } from '@/lib/session';
import { addDays, formatDate, weekStart } from '@/lib/utils';
import { CheckinForm } from '../checkin-form';

export const metadata: Metadata = { title: 'Plano · Mentoria' };

export default async function MentoriaPlan({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const viewer = await requireViewer();
  const m = await getMentoria(emailKey(viewer.email));
  if (!m) return null;
  const { w } = await searchParams;
  const today = todayBR();
  const current = weekStart(new Date(`${today}T12:00:00`));
  const week = /^\d{4}-\d{2}-\d{2}$/.test(w ?? '') ? weekStart(new Date(`${w}T12:00:00`)) : current;
  const [tasks, list] = await Promise.all([weekTasks(m.id, week), checkins(m.id)]);
  const thisCheckin = list.find((c) => c.week_start === week) ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="min-w-0 p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-ink">Plano da semana</p>
            <p className="text-xs text-muted">
              {formatDate(week)} – {formatDate(addDays(week, 6))}
              {week === current && ' · semana atual'}
            </p>
          </div>
          <div className="flex gap-1">
            <Link href={`/mentoria/plano?w=${addDays(week, -7)}`} scroll={false} className={buttonClass('secondary', 'icon', 'size-9')} aria-label="Semana anterior">
              <ChevronLeft className="size-4" />
            </Link>
            <Link href={`/mentoria/plano?w=${addDays(week, 7)}`} scroll={false} className={buttonClass('secondary', 'icon', 'size-9')} aria-label="Próxima semana">
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </div>
        <WeekPlan key={week} tasks={tasks} week={week} today={today} />
      </Card>

      <div className="space-y-4">
        <Card className="p-4 sm:p-5">
          <p className="text-sm font-bold text-ink">Check-in da semana</p>
          <p className="mb-4 text-xs text-muted">Conte como foi a semana. O mentor responde com um feedback.</p>
          <CheckinForm key={week} mentoriaId={m.id} week={week} checkin={thisCheckin} />
        </Card>
        {list.filter((c) => c.mentor_feedback && c.week_start !== week).slice(0, 3).map((c) => (
          <Card key={c.id} className="p-4">
            <p className="flex items-center gap-1.5 text-xs font-bold text-brand">
              <MessageSquareQuote className="size-3.5" /> Feedback · semana de {formatDate(c.week_start)}
            </p>
            <p className="mt-1.5 text-sm whitespace-pre-line text-ink-2">{c.mentor_feedback}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
