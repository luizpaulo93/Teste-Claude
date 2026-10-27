import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireViewer } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { Simulado, SimuladoResult, SimuladoStats, SimuladoSubmission } from '@/lib/types';
import { ExamRunner } from './exam-runner';
import { ResultView } from './result-view';
import { StartCard } from './start-card';

export const metadata: Metadata = { title: 'Simulado' };

export default async function SimuladoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const viewer = await requireViewer();
  if (!viewer.isMember) redirect('/');
  const supabase = await createClient();
  const [{ data: sim }, { data: sub }, { data: result }] = await Promise.all([
    supabase.from('simulados').select('*').eq('id', id).maybeSingle(),
    supabase.from('simulado_submissions').select('*').eq('simulado_id', id).eq('user_id', viewer.userId).maybeSingle(),
    supabase.from('simulado_results').select('*').eq('simulado_id', id).eq('user_id', viewer.userId).maybeSingle(),
  ]);
  if (!sim) notFound();
  const simulado = sim as Simulado;
  const submission = sub as SimuladoSubmission | null;

  let pdfUrl = '';
  if (simulado.pdf_path && (!submission || submission.status === 'in_progress' || simulado.results_released)) {
    const { data } = await supabase.storage.from('materials').createSignedUrl(simulado.pdf_path, 60 * 60 * 6);
    pdfUrl = data?.signedUrl ?? '';
  }

  let body: React.ReactNode;
  if (result && simulado.results_released) {
    body = <ResultView simulado={simulado} result={result as SimuladoResult} stats={simulado.stats as SimuladoStats} pdfUrl={pdfUrl} />;
  } else if (submission?.status === 'in_progress' && !simulado.results_released) {
    body = <ExamRunner simulado={simulado} submission={submission} pdfUrl={pdfUrl} serverNow={Date.now()} />;
  } else {
    body = <StartCard simulado={simulado} submission={submission} userId={viewer.userId} />;
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
