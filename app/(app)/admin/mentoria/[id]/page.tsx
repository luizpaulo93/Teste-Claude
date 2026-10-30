import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PlanBuilder } from '@/components/mentoria/plan-builder';
import { WeekView } from '@/components/mentoria/week-view';
import { Card } from '@/components/ui';
import { ASSUNTOS, DISCIPLINES } from '@/lib/enem-matriz';
import { cards, ensureFresh, getMentoria } from '@/lib/mentoria-data';
import { MentoriaAdminCard } from './admin-card';

export const metadata: Metadata = { title: 'Mentorado · Admin' };

export default async function AdminMentoriaPlan({ params }: { params: Promise<{ id: string }> }) {
  const m = await getMentoria(decodeURIComponent((await params).id));
  if (!m) notFound();
  await ensureFresh(m.id);
  const list = await cards(m.id);
  const disciplines = DISCIPLINES.map((d) => {
    const all = ASSUNTOS.filter((a) => a.discipline === d.key);
    return { key: d.key, name: d.name, count: all.length, top: all.filter((a) => a.priority >= 3).length };
  });
  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <PlanBuilder mentoriaId={m.id} disciplines={disciplines} chosen={m.plan_disciplines} order={m.plan_order} hasSchedule={Boolean(m.diagnosed_at)} />
      </Card>
      {list.length > 0 && (
        <section className="space-y-2">
          <p className="text-sm font-bold text-ink">Próximos 7 dias</p>
          <WeekView cards={list} availability={m.availability} names={Object.fromEntries(DISCIPLINES.map((d) => [d.key, d.name]))} />
        </section>
      )}
      <MentoriaAdminCard mentoria={m} />
    </div>
  );
}
