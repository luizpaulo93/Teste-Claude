import { isDocId } from '@/lib/utils';
import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireViewer } from '@/lib/session';
import { createDownloadUrl } from '@/lib/storage/server';
import { db, fromDoc } from '@/lib/db';
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
  const d = db();
  const [simSnap, subSnap, resSnap] = await Promise.all([
    d.doc(`simulados/${id}`).get(),
    d.doc(`simulado_submissions/${id}_${viewer.userId}`).get(),
    d.doc(`simulado_results/${id}_${viewer.userId}`).get(),
  ]);
  const simulado = fromDoc<Simulado>(simSnap);
  if (!simulado || (!simulado.is_published && !viewer.isAdmin)) notFound();
  const submission = fromDoc<SimuladoSubmission>(subSnap);
  const result = fromDoc<SimuladoResult>(resSnap);

  let pdfUrl = '';
  if (simulado.pdf_path && (!submission || submission.status === 'in_progress' || simulado.results_released)) {
    pdfUrl = await createDownloadUrl(simulado.pdf_path, 60 * 60 * 6);
  }

  let body: React.ReactNode;
  if (result && simulado.results_released) {
    body = <ResultView simulado={simulado} result={result} stats={simulado.stats as SimuladoStats} pdfUrl={pdfUrl} />;
  } else if (submission?.status === 'in_progress' && !simulado.results_released) {
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
