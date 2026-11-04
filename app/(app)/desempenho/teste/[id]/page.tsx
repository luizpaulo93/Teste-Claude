import { ArrowLeft, ListChecks } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ListReport } from '@/components/questoes/list-report';
import { buttonClass, Card, PageHeader } from '@/components/ui';
import { sql } from '@/lib/db';
import { canSeeList, getList, questionsOf } from '@/lib/question-lists';
import { requireViewer } from '@/lib/session';

export const metadata: Metadata = { title: 'Relatório do teste' };

/** Relatório individual do teste (1ª tentativa, a que conta nas estatísticas) e o atalho para as questões. */
export default async function TesteRelatorio({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireViewer();
  const list = await getList((await params).id);
  if (!list || !(await canSeeList(viewer, list))) notFound();
  const fin = await sql.one<{
    finished_at: string;
    ok: number | null;
    total: number | null;
    attempts: number;
    open: boolean;
    answers: Record<string, { letter: string; correct: boolean }> | null;
  }>(`select finished_at, ok, total, attempts, open, answers from list_finishes where list_id = $1 and user_id = $2`, [list.id, viewer.userId]);
  if (!fin) redirect(`/listas/${list.id}`);
  const qs = await questionsOf(list);
  // respostas da 1ª tentativa; listas antigas (sem a foto da 1ª) usam as respostas atuais
  const first =
    fin.answers ??
    Object.fromEntries(
      (
        await sql.query<{ question_id: string; letter: string; correct: boolean }>(
          `select question_id, letter, correct from list_responses where list_id = $1 and user_id = $2`,
          [list.id, viewer.userId],
        )
      ).map((r) => [r.question_id, { letter: r.letter, correct: r.correct }]),
    );
  const counted = qs.filter((q) => q.status !== 'anulada');
  const ok = fin.ok ?? counted.filter((q) => first[q.id]?.correct).length;
  const total = fin.total ?? counted.length;
  const blank = counted.filter((q) => !first[q.id]).length;
  const pct = total ? Math.round((ok / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl min-w-0">
      <Link href="/desempenho" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Desempenho
      </Link>
      <PageHeader eyebrow={list.owner_id ? 'Minha lista · relatório' : 'Teste · relatório'} title={list.title} />
      <Card className="mb-5 p-4 text-center">
        <p className="text-sm text-muted">Resultado da 1ª tentativa</p>
        <p className="text-3xl font-extrabold text-ink">
          {ok}/{total}
        </p>
        <p className="text-xs text-muted">
          {pct}% de acerto · {blank} em branco · {new Date(fin.finished_at).toLocaleDateString('pt-BR', { timeZone: 'America/Belem' })}
        </p>
        {fin.attempts > 1 && <p className="mt-2 text-[11px] text-muted">Você refez {fin.attempts - 1}x; só a 1ª tentativa conta nas estatísticas.</p>}
      </Card>
      <ListReport
        base={`/listas/${list.id}?de=desempenho`}
        qs={counted.map((q) => ({
          n: qs.indexOf(q) + 1,
          disciplina: q.disciplina,
          assunto: q.assunto_geral,
          especifico: q.assunto_especifico,
          answered: Boolean(first[q.id]),
          correct: Boolean(first[q.id]?.correct),
        }))}
      />
      <Link href={`/listas/${list.id}?de=desempenho`} className={buttonClass('primary', 'md', 'mt-6 w-full')}>
        <ListChecks className="size-4" /> Acessar as questões
      </Link>
    </div>
  );
}
