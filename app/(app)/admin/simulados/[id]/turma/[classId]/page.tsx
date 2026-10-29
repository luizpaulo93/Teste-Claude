import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { QuestionChart, StudentRanking } from '@/components/simulado/report';
import { PageHeader, Stat } from '@/components/ui';
import { classRanking, loadSimuladoReport, questionHits, summarize } from '@/lib/simulado-report';
import { isDocId } from '@/lib/utils';

export const metadata: Metadata = { title: 'Turma · Simulado' };

/** Relatório de uma turma em um simulado: números da turma e alunos em ranking. */
export default async function ClassReport({ params }: { params: Promise<{ id: string; classId: string }> }) {
  const { id, classId } = await params;
  if (!isDocId(id) || !/^[\w-]{1,64}$/.test(classId)) notFound();
  const report = await loadSimuladoReport(id);
  if (!report) notFound();
  const { simulado, answerKey, useTri, rows, className } = report;
  const cid = classId === 'sem-turma' ? null : classId;
  const mine = rows.filter((r) => (r.class_id ?? null) === cid);
  const sum = summarize(mine, useTri);
  const ranking = classRanking(rows, useTri, className);
  const pos = ranking.findIndex((c) => c.id === classId);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/simulados/${simulado.id}`} className="mb-3 inline-flex max-w-full items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
          <ChevronLeft className="size-4 shrink-0" /> <span className="truncate">{simulado.title}</span>
        </Link>
        <PageHeader eyebrow="Turma" title={className(cid)} subtitle={pos >= 0 ? `${pos + 1}º lugar entre ${ranking.length} turma${ranking.length === 1 ? '' : 's'}` : undefined} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Entregas" value={sum.entregas} hint={sum.fazendo ? `${sum.fazendo} fazendo agora` : undefined} />
        {useTri && <Stat label="Média TRI" value={sum.meanTri ?? '—'} />}
        <Stat label="Média de acertos" value={sum.meanCorrect ?? '—'} hint={sum.meanAccuracy != null ? `${sum.meanAccuracy}% da prova` : undefined} />
        <Stat label={useTri ? 'Maior TRI' : 'Mais acertos'} value={sum.best ?? '—'} />
      </div>

      <QuestionChart items={questionHits(mine, answerKey, simulado.question_count)} />

      <StudentRanking rows={mine} useTri={useTri} total={simulado.question_count} title="Alunos da turma" />
    </div>
  );
}
