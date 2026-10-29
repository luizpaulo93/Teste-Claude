import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ClassCards, QuestionChart, StudentRanking } from '@/components/simulado/report';
import { PageHeader, Stat } from '@/components/ui';
import { classRanking, loadSimuladoReport, questionHits, summarize } from '@/lib/simulado-report';
import { ENEM_AREAS } from '@/lib/types';
import { isDocId } from '@/lib/utils';
import { ResetButton, SimuladoAdminActions } from './simulado-admin-actions';

export const metadata: Metadata = { title: 'Simulado · Admin' };

export default async function AdminSimulado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isDocId(id)) notFound();
  const report = await loadSimuladoReport(id);
  if (!report) notFound();
  const { simulado, answerKey, useTri, rows, className } = report;
  const sum = summarize(rows, useTri);
  const classes = classRanking(rows, useTri, className);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/simulados" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
          <ChevronLeft className="size-4" /> Simulados
        </Link>
        <PageHeader
          eyebrow={ENEM_AREAS[simulado.area]}
          title={simulado.title}
          subtitle={`${simulado.question_count} questões · ${simulado.time_limit_minutes ? `${simulado.time_limit_minutes} min` : 'tempo livre'}${answerKey.length === simulado.question_count ? '' : ' · ⚠ gabarito incompleto'}`}
          actions={<SimuladoAdminActions simulado={simulado} answerKey={answerKey} />}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Entregas" value={sum.entregas} hint={sum.fazendo ? `${sum.fazendo} fazendo agora` : undefined} />
        {useTri ? <Stat label="Média TRI" value={sum.meanTri ?? '—'} hint={simulado.results_released ? undefined : 'Sai ao liberar'} /> : <Stat label="Tipo" value="Sem TRI" hint="Só acertos" />}
        <Stat label="Média de acertos" value={sum.meanCorrect ?? '—'} hint={sum.meanAccuracy != null ? `${sum.meanAccuracy}% da prova` : undefined} />
        <Stat label="Status" value={<span className="text-base">{simulado.results_released ? 'Liberado' : simulado.is_published ? 'Aberto' : 'Rascunho'}</span>} />
      </div>

      <QuestionChart items={questionHits(rows, answerKey, simulado.question_count)} />

      <ClassCards items={classes} useTri={useTri} hrefFor={(cid) => `/admin/simulados/${simulado.id}/turma/${cid}`} />

      <StudentRanking
        rows={rows.map((r) => ({ ...r, className: className(r.class_id) }))}
        showClass
        useTri={useTri}
        total={simulado.question_count}
        title="Ranking geral"
        extra={(r) => <ResetButton simuladoId={simulado.id} userId={r.user_id} />}
      />
    </div>
  );
}
