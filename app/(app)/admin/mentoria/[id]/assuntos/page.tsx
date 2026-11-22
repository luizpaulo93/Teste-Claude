import { notFound } from 'next/navigation';
import { TrailPath, type TrailRow } from '@/components/mentoria/trail-path';
import { todayBR } from '@/lib/mentoria';
import { assuntoRows, getMentoria } from '@/lib/mentoria-data';

/** A trilha como o aluno vê (para o mentor conferir). */
export default async function AdminMentoradoTrail({ params }: { params: Promise<{ id: string }> }) {
  const m = await getMentoria(decodeURIComponent((await params).id));
  if (!m) notFound();
  const { rows, disciplines } = await assuntoRows(m.id, undefined, m.scope);
  const used = disciplines.filter((d) => rows.some((r) => r.discipline === d.key && r.level !== null));
  if (!used.length)
    return (
      <p className="rounded-xl border border-dashed border-line-strong p-8 text-center text-sm text-muted">Monte a trilha na aba Trilha para ver os assuntos.</p>
    );
  return <TrailPath rows={rows as TrailRow[]} disciplines={used} today={todayBR()} />;
}
