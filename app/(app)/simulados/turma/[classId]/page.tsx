import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ComboPoint } from '@/components/charts/combo-chart';
import { PageHeader } from '@/components/ui';
import { requireViewer } from '@/lib/session';
import { loadOverview } from '@/lib/simulado-report';
import { fmt, KindTabs, MeansChart, RankList } from '../../overview';

export const metadata: Metadata = { title: 'Turma · Simulados' };

/** Nota geral da turma em cada simulado e os alunos em ranking. */
export default async function ClassOverview({ params, searchParams }: { params: Promise<{ classId: string }>; searchParams: Promise<{ v?: string }> }) {
  const [{ classId }, sp] = await Promise.all([params, searchParams]);
  if (!/^[\w-]{1,64}$/.test(classId)) notFound();
  const viewer = await requireViewer();
  if (!viewer.isAdmin) redirect('/simulados');
  const kind = sp.v === 'sem' ? 'sem' : 'tri';
  const o = await loadOverview(kind);
  const inClass = (r: { class_id: string | null }) => o.classKey(r.class_id) === classId;
  const points: ComboPoint[] = o
    .perSim(inClass)
    .map((s) => ({ label: s.title, bar: s.mean, barLabel: fmt(kind, s.mean!), href: `/admin/simulados/${s.id}/turma/${classId}` }));
  const classes = o.classes();
  const pos = classes.findIndex((c) => c.id === classId);

  return (
    <div className="space-y-4">
      <Link href={`/simulados${kind === 'sem' ? '?v=sem' : ''}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Simulados
      </Link>
      <PageHeader
        eyebrow="Turma"
        title={o.className(classId === 'sem-turma' ? null : classId)}
        subtitle={pos >= 0 ? `${pos + 1}º lugar entre ${classes.length} turma${classes.length === 1 ? '' : 's'}` : undefined}
      />
      <KindTabs kind={kind} base={`/simulados/turma/${classId}`} />
      <MeansChart kind={kind} title={kind === 'tri' ? 'Média TRI da turma por simulado' : 'Acertos da turma por simulado'} points={points} />
      <RankList
        title="Alunos da turma"
        icon="trophy"
        items={o.students(inClass).map((s) => ({
          key: s.user_id,
          href: `/desempenho/aluno/${s.user_id}`,
          name: s.name,
          sub: `${s.provas} prova${s.provas === 1 ? '' : 's'} · ${s.correct} acertos em média`,
          value: fmt(kind, s.mean),
          unit: kind === 'tri' ? 'média TRI' : 'acertos',
        }))}
      />
    </div>
  );
}
