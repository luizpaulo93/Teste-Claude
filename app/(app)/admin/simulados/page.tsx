import { ClipboardCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { sql } from '@/lib/db';
import { ENEM_AREAS, type Simulado } from '@/lib/types';
import { NewSimuladoButton } from './new-simulado';

export const metadata: Metadata = { title: 'Simulados · Admin' };

export default async function AdminSimulados() {
  const [sims, subs] = await Promise.all([
    sql.query<Simulado>(`select * from simulados order by created_at desc`),
    sql.query<{ simulado_id: string; status: string; n: number }>(`select simulado_id, status, count(*)::int as n from simulado_submissions group by 1, 2`),
  ]);
  const count = (id: string, st: string) => subs.find((s) => s.simulado_id === id && s.status === st)?.n ?? 0;
  return (
    <>
      <PageHeader title="Simulados" subtitle="Crie provas no padrão ENEM, acompanhe entregas e libere a nota TRI." actions={<NewSimuladoButton />} />
      {sims.length ? (
        <div className="grid gap-3">
          {sims.map((s) => (
            <Link key={s.id} href={`/admin/simulados/${s.id}`}>
              <Card className="flex items-center gap-4 p-4 transition hover:border-brand/40">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-sm font-extrabold text-brand">{s.area}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{s.title}</p>
                  <p className="text-xs text-muted">
                    {ENEM_AREAS[s.area]} · {s.question_count} questões · {s.time_limit_minutes ? `${s.time_limit_minutes} min` : 'tempo livre'}
                  </p>
                </div>
                <div className="hidden flex-wrap justify-end gap-1.5 sm:flex">
                  <Badge tone={s.is_published ? 'success' : 'neutral'}>{s.is_published ? 'Publicado' : 'Rascunho'}</Badge>
                  {s.results_released && <Badge tone="brand">Resultados liberados</Badge>}
                  <Badge>{count(s.id, 'completed')} entregas</Badge>
                  {count(s.id, 'in_progress') > 0 && <Badge tone="warning">{count(s.id, 'in_progress')} fazendo</Badge>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState icon={<ClipboardCheck className="size-6" />} title="Nenhum simulado" description="Crie o primeiro simulado com PDF e gabarito." action={<NewSimuladoButton />} />
      )}
    </>
  );
}
