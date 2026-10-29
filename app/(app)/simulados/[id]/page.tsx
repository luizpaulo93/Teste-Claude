import { isDocId } from '@/lib/utils';
import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireViewer } from '@/lib/session';
import { createDownloadUrl } from '@/lib/storage/server';
import { sql } from '@/lib/db';
import type { Simulado, SimuladoResult, SimuladoStats, SimuladoSubmission } from '@/lib/types';
import { ExamRunner } from './exam-runner';
import { ResultView } from './result-view';
import { StartCard } from './start-card';

export const metadata: Metadata = { title: 'Simulado' };

export default async function SimuladoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isDocId(id)) notFound();
  const viewer = await requireViewer();
  if (!viewer.isMember) redirect('/');
  const [simulado, submission, result] = await Promise.all([
    sql.one<Simulado>(`select * from simulados where id = $1`, [id]),
    sql.one<SimuladoSubmission>(`select * from simulado_submissions where simulado_id = $1 and user_id = $2`, [id, viewer.userId]),
    sql.one<SimuladoResult>(`select * from simulado_results where simulado_id = $1 and user_id = $2`, [id, viewer.userId]),
  ]);
  if (!simulado || (!simulado.is_published && !viewer.isAdmin)) notFound();

  let pdfUrl = '';
  if (simulado.pdf_path && (!submission || submission.status === 'in_progress' || simulado.results_released)) {
    pdfUrl = await createDownloadUrl(simulado.pdf_path, 60 * 60 * 6);
  }

  let body: React.ReactNode;
  if (result && simulado.results_released) {
    body = <ResultView simulado={simulado} result={result} stats={simulado.stats as SimuladoStats} pdfUrl={pdfUrl} />;
  } else if (submission?.status === 'in_progress') {
    body = <ExamRunner simulado={simulado} submission={submission} pdfUrl={pdfUrl} serverNow={Date.now()} />;
  } else {
    body = <StartCard simulado={simulado} submission={submission} />;
  }

  return (
    <>
      <Link href="/simulados" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Simulados
      </Link>
      {body}
    </>
  );
}
