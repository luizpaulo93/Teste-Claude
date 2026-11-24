import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlocksPanel } from '@/components/mentoria/blocks-panel';
import { DayList } from '@/components/mentoria/day-list';
import { Card } from '@/components/ui';
import { blocksOf, blocksOnDay, spacesOfMentoria } from '@/lib/mentoria-blocks';
import { cards, dayData, ensureFresh, getMentoria, weekData } from '@/lib/mentoria-data';
import { ViewToggle } from '@/components/mentoria/view-toggle';
import { WeekGrid, WeekSummary } from '@/components/mentoria/week-view';
import { todayBR } from '@/lib/mentoria';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Agenda · Mentorado' };

/** Agenda do aluno (o que cai em cada dia) e os períodos/apostilas que o mentor liga aos dias. */
export default async function AdminMentoriaAgenda({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ d?: string; v?: string }> }) {
  const m = await getMentoria(decodeURIComponent((await params).id));
  if (!m) notFound();
  await ensureFresh(m.id);
  const sp = await searchParams;
  const view = sp.v === 'dia' ? 'dia' : 'semana';
  const [list, data, spaces, week] = await Promise.all([cards(m.id), dayData(m, sp.d), spacesOfMentoria(m.id), view === 'semana' ? weekData(m, sp.d) : null]);
  const base = `/admin/mentoria/${encodeURIComponent(m.id)}/agenda`;
  const blocks = await blocksOf(spaces);
  const extras = list.filter((c) => c.pinned_on && !c.block_id).sort((a, b) => a.pinned_on!.localeCompare(b.pinned_on!));
  return (
    <div className="space-y-4">
      <ViewToggle view={view} day={data.day} base={base} />
      {week && (
        <>
          <WeekSummary summary={week.summary} monday={week.monday} today={week.today} hoursHref={`/admin/mentoria/${encodeURIComponent(m.id)}/horarios`} />
          <WeekGrid today={week.today} week={week.week} selected={data.day} days={week.days} basePath={base} />
        </>
      )}
      <Card className="p-4 sm:p-5">
        <DayList key={data.day + data.items.length} {...data} mentoriaId={m.id} folder={blocksOnDay(blocks, data.day)} strip={view === 'dia'} />
      </Card>
      {extras.length > 0 && (
        <Card className="p-4 sm:p-5">
          <p className="text-sm font-semibold text-ink">
            O aluno acrescentou {extras.length} assunto{extras.length > 1 ? 's' : ''}
          </p>
          <ul className="mt-2 space-y-1 text-xs text-ink-2">
            {extras.map((c) => (
              <li key={c.id}>
                <span className="num font-medium text-ink">{formatDate(c.pinned_on!)}</span> · {c.title}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card className="p-4 sm:p-5">
        <BlocksPanel space={`m:${m.id}`} blocks={blocks.filter((b) => b.space === `m:${m.id}`)} today={todayBR()} />
      </Card>
    </div>
  );
}
