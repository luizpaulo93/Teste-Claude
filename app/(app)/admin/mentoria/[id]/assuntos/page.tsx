import { notFound } from 'next/navigation';
import { AssuntosView } from '@/components/mentoria/assuntos-view';
import { assuntoRows, getMentoria } from '@/lib/mentoria-data';

export default async function AdminMentoradoSubjects({ params }: { params: Promise<{ id: string }> }) {
  const m = await getMentoria(decodeURIComponent((await params).id));
  if (!m) notFound();
  const { rows, disciplines } = await assuntoRows(m.id, undefined, m.scope);
  if (!disciplines.length) return <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-sm text-muted">Monte o cronograma na aba Cronograma para ver os assuntos.</p>;
  return <AssuntosView rows={rows} disciplines={disciplines} />;
}
