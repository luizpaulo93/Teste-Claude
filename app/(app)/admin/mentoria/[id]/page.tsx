import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PlanBuilder } from '@/components/mentoria/plan-builder';
import { DayList } from '@/components/mentoria/day-list';
import { Card } from '@/components/ui';
import { ASSUNTOS, DISCIPLINES } from '@/lib/enem-matriz';
import { cards, dayData, ensureFresh, getMentoria, planEnd } from '@/lib/mentoria-data';
import { todayBR } from '@/lib/mentoria';
import { formatDate } from '@/lib/utils';
import { MentoriaAdminCard } from './admin-card';

export const metadata: Metadata = { title: 'Mentorado · Admin' };

export default async function AdminMentoriaPlan({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ d?: string }> }) {
  const m = await getMentoria(decodeURIComponent((await params).id));
  if (!m) notFound();
  await ensureFresh(m.id);
  const [list, data] = await Promise.all([cards(m.id), dayData(m, (await searchParams).d)]);
  const end = planEnd(m, todayBR());
  const out = list.filter((c) => c.scheduled_on === null).length;
  const disciplines = DISCIPLINES.map((d) => {
    const all = ASSUNTOS.filter((a) => a.discipline === d.key);
    return { key: d.key, name: d.name, count: all.length, top: all.filter((a) => a.priority >= 3).length };
  });
  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <PlanBuilder mentoriaId={m.id} disciplines={disciplines} chosen={m.plan_disciplines} order={m.plan_order} hasSchedule={Boolean(m.diagnosed_at)} />
        {list.length > 0 && (
          <p className="mt-4 rounded-xl bg-surface-2/60 p-3 text-xs text-ink-2">
            Cronograma até <strong className="text-ink">{formatDate(end)}</strong>
            {m.end_date ? ' (fim da mentoria)' : m.exam_date ? ' (data da prova)' : ' (6 meses; cadastre o fim da mentoria em Editar)'}:{' '}
            <strong className="text-ink">{list.length - out}</strong> de {list.length} assuntos cabem no período
            {out > 0 && <span className="text-warning"> · {out} menos cobrados ficaram de fora — aumente os horários ou o período</span>}.
          </p>
        )}
      </Card>
      {list.length > 0 && (
        <Card className="p-4 sm:p-5">
          <DayList key={data.day} {...data} mentoriaId={m.id} />
        </Card>
      )}
      <MentoriaAdminCard mentoria={m} />
    </div>
  );
}
