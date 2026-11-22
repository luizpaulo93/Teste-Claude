import type { Metadata } from 'next';
import { TrailPath, type TrailRow } from '@/components/mentoria/trail-path';
import { emailKey } from '@/lib/db';
import { todayBR } from '@/lib/mentoria';
import { assuntoRows, ensureFresh, getMentoria } from '@/lib/mentoria-data';
import { requireViewer } from '@/lib/session';

export const metadata: Metadata = { title: 'Trilha · Mentoria' };

/** Trilha do aluno: teoria → níveis 1, 2 e 3 → dominado, assunto por assunto. */
export default async function MentoriaTrail() {
  const viewer = await requireViewer();
  const m = await getMentoria(emailKey(viewer.email));
  if (!m) return null;
  await ensureFresh(m.id);
  const { rows, disciplines } = await assuntoRows(m.id, undefined, m.scope);
  const used = disciplines.filter((d) => rows.some((r) => r.discipline === d.key && r.level !== null));
  if (!used.length)
    return (
      <p className="rounded-xl border border-dashed border-line-strong p-8 text-center text-sm text-muted">
        Sua trilha aparece quando o mentor escolher os assuntos.
      </p>
    );
  return <TrailPath rows={rows as TrailRow[]} disciplines={used} today={todayBR()} />;
}
