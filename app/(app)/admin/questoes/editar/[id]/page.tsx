import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { getQuestion, paperLabel } from '@/lib/questions';
import { requireAdmin } from '@/lib/session';
import { QuestionEditor } from './question-editor';

export const metadata: Metadata = { title: 'Editar questão · Admin' };

/** Correção manual de uma questão (fórmulas, textos, alternativas, gabarito e resolução). */
export default async function EditQuestion({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ onde?: string }> }) {
  await requireAdmin();
  const q = await getQuestion(decodeURIComponent((await params).id));
  if (!q) notFound();
  const label = paperLabel(q.paper);
  return (
    <>
      <PageHeader eyebrow={label} title={`Questão ${q.numero}`} subtitle="Corrija o que estiver errado. A prévia embaixo de cada campo mostra como o aluno vai ver." />
      <QuestionEditor
        key={q.id + String((q as { updated_at?: string }).updated_at ?? '')}
        id={q.id}
        numero={q.numero}
        paperLabel={label}
        focus={(await searchParams).onde}
        initial={{
          blocos: q.blocos ?? [],
          alternativas: q.alternativas ?? [],
          gabarito: q.gabarito,
          resolucao: q.resolucao ?? '',
          resolucao_blocos: q.resolucao_blocos ?? [],
        }}
      />
    </>
  );
}
