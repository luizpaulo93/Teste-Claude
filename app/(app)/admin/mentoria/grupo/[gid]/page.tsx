import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AssuntoPicker } from '@/components/mentoria/assunto-picker';
import { PlanBuilder } from '@/components/mentoria/plan-builder';
import { BlocksPanel } from '@/components/mentoria/blocks-panel';
import { Card } from '@/components/ui';
import { todayBR } from '@/lib/mentoria';
import { blocksOf } from '@/lib/mentoria-blocks';
import { ASSUNTOS, DISCIPLINES } from '@/lib/enem-matriz';
import { getGroup } from '@/lib/mentoria-space';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Mentoria em grupo · Admin' };

/** Cronograma do grupo: os mesmos assuntos para todos; cada aluno segue no seu ritmo e nos seus horários. */
export default async function GroupPlan({ params }: { params: Promise<{ gid: string }> }) {
  const g = await getGroup((await params).gid);
  if (!g) notFound();
  const disciplines = DISCIPLINES.map((d) => {
    const all = ASSUNTOS.filter((a) => a.discipline === d.key);
    return { key: d.key, name: d.name, count: all.length, top: all.filter((a) => a.priority >= 3).length };
  });
  const blocks = await blocksOf([`g:${g.id}`]);
  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <BlocksPanel space={`g:${g.id}`} blocks={blocks} today={todayBR()} />
      </Card>
      {g.scope !== 'especifica' && (
      <Card className="p-4 sm:p-5">
        <PlanBuilder groupId={g.id} disciplines={disciplines} chosen={g.plan_disciplines} order={g.plan_order} hasSchedule />
        <p className="mt-4 rounded-xl bg-surface-2/60 p-3 text-xs text-ink-2">
          Todos começam com os mesmos {g.plan_keys.length} assuntos{g.end_date ? `, fechando em ${formatDate(g.end_date)}` : ''}. Depois, o cronograma de cada aluno é só
          dele: revisões e ritmo mudam pelo acerto e pelo que ele sentiu em cada assunto. Para ajustar um aluno, abra-o na aba Alunos.
        </p>
      </Card>
      )}
      <Card className="p-4 sm:p-5">
        <details className="group" open={g.scope === 'especifica' && g.plan_keys.length === 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 select-none [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block text-sm font-bold text-ink">{g.scope === 'especifica' ? 'Assuntos da mentoria específica' : 'Escolher assuntos manualmente'}</span>
              <span className="block text-xs text-muted">{g.plan_keys.length} assuntos no cronograma do grupo · adicione ou tire qualquer um</span>
            </span>
            <span className="text-xs font-semibold text-brand group-open:hidden">Abrir</span>
          </summary>
          <div className="mt-4">
            <AssuntoPicker key={g.plan_keys.join().length} groupId={g.id} selected={g.plan_keys} />
          </div>
        </details>
      </Card>
    </div>
  );
}
