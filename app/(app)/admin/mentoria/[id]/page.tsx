import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PlanBuilder } from '@/components/mentoria/plan-builder';
import { AssuntoPicker } from '@/components/mentoria/assunto-picker';
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
  const extras = list.filter((c) => c.pinned_on).sort((a, b) => a.pinned_on!.localeCompare(b.pinned_on!));
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
      {extras.length > 0 && (
        <Card className="border-violet-500/40 p-4 sm:p-5">
          <p className="text-sm font-bold text-ink">O aluno acrescentou {extras.length} assunto{extras.length > 1 ? 's' : ''}</p>
          <ul className="mt-2 space-y-1 text-xs text-ink-2">
            {extras.map((c) => (
              <li key={c.id}>
                <span className="font-semibold text-violet-500">{formatDate(c.pinned_on!)}</span> · {c.title}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card className="p-4 sm:p-5">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 select-none [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block text-sm font-bold text-ink">Escolher assuntos manualmente</span>
              <span className="block text-xs text-muted">{list.length} assuntos no cronograma · adicione ou tire qualquer um</span>
            </span>
            <span className="text-xs font-semibold text-brand group-open:hidden">Abrir</span>
          </summary>
          <div className="mt-4">
            <AssuntoPicker key={list.length + list.map((c) => c.item_key).join().length} mentoriaId={m.id} selected={list.map((c) => c.item_key)} />
          </div>
        </details>
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
