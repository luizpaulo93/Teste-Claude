import { CheckCircle2, ClipboardCheck, Clock, Hourglass, Lock, Trophy } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LineChart } from '@/components/charts/line-chart';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { requireViewer } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { ENEM_AREAS, type Simulado, type SimuladoResult, type SimuladoSubmission } from '@/lib/types';

export const metadata: Metadata = { title: 'Simulados' };

export default async function SimuladosPage() {
  const viewer = await requireViewer();
  if (!viewer.isMember) redirect('/');
  const supabase = await createClient();
  const [{ data: sims }, { data: subs }, { data: results }] = await Promise.all([
    supabase.from('simulados').select('id,title,area,question_count,time_limit_minutes,results_released,created_at').eq('is_published', true).order('created_at', { ascending: false }),
    supabase.from('simulado_submissions').select('simulado_id,status').eq('user_id', viewer.userId),
    supabase.from('simulado_results').select('simulado_id,tri_score,correct,accuracy').eq('user_id', viewer.userId),
  ]);
  const simulados = (sims ?? []) as Simulado[];
  const subBy = new Map((subs ?? []).map((s: Pick<SimuladoSubmission, 'simulado_id' | 'status'>) => [s.simulado_id, s.status]));
  const resBy = new Map((results ?? []).map((r: Pick<SimuladoResult, 'simulado_id' | 'tri_score' | 'correct' | 'accuracy'>) => [r.simulado_id, r]));

  const chart = simulados
    .filter((s) => resBy.has(s.id))
    .reverse()
    .map((s) => ({ label: s.title, value: Number(resBy.get(s.id)!.tri_score) }));

  return (
    <>
      <PageHeader eyebrow="ENEM" title="Simulados" subtitle="Faça as provas no tempo oficial e acompanhe sua nota estimada pela TRI." />

      {chart.length > 1 && (
        <Card className="mb-8 p-4 sm:p-6">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
            <Trophy className="size-4 text-warning" /> Sua evolução (nota TRI)
          </p>
          <LineChart points={chart} />
        </Card>
      )}

      {simulados.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {simulados.map((s) => {
            const st = subBy.get(s.id);
            const r = resBy.get(s.id);
            let badge = <Badge tone="brand">Disponível</Badge>;
            if (r) badge = <Badge tone="success"><Trophy className="size-3" /> {Number(r.tri_score).toFixed(0)} pts</Badge>;
            else if (st === 'completed') badge = <Badge tone="warning"><Hourglass className="size-3" /> Aguardando resultado</Badge>;
            else if (st === 'in_progress') badge = <Badge tone="warning"><Clock className="size-3" /> Em andamento</Badge>;
            else if (s.results_released) badge = <Badge><Lock className="size-3" /> Encerrado</Badge>;
            return (
              <Link key={s.id} href={`/simulados/${s.id}`} className="group">
                <Card className="h-full p-5 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-brand/40 group-hover:shadow-glow">
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-sm font-extrabold text-brand">{s.area}</span>
                    {badge}
                  </div>
                  <p className="mt-4 line-clamp-2 font-bold text-ink">{s.title}</p>
                  <p className="mt-1 text-xs text-muted">{ENEM_AREAS[s.area]}</p>
                  <div className="mt-4 flex gap-4 text-xs text-ink-2">
                    <span className="flex items-center gap-1.5"><ClipboardCheck className="size-3.5" /> {s.question_count} questões</span>
                    <span className="flex items-center gap-1.5"><Clock className="size-3.5" /> {s.time_limit_minutes ? `${s.time_limit_minutes} min` : 'Tempo livre'}</span>
                  </div>
                  {r && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-success">
                      <CheckCircle2 className="size-3.5" /> {r.correct} acertos · {r.accuracy}%
                    </p>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={<ClipboardCheck className="size-6" />} title="Nenhum simulado publicado" description="Quando um novo simulado for liberado ele aparece aqui." />
      )}
    </>
  );
}
