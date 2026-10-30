import type { Metadata } from 'next';
import { AssuntosView } from '@/components/mentoria/assuntos-view';
import { emailKey } from '@/lib/db';
import { todayBR } from '@/lib/mentoria';
import { assuntoRows, getMentoria } from '@/lib/mentoria-data';
import { requireViewer } from '@/lib/session';

export const metadata: Metadata = { title: 'Assuntos · Mentoria' };

export default async function MentoriaSubjects() {
  const viewer = await requireViewer();
  const m = await getMentoria(emailKey(viewer.email));
  if (!m) return null;
  const { rows, disciplines } = await assuntoRows(m.id);
  if (!disciplines.length) return <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-sm text-muted">Os assuntos aparecem quando o mentor montar seu cronograma.</p>;
  return <AssuntosView rows={rows} disciplines={disciplines} today={todayBR()} student />;
}
