import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Answer, type AltView, type Reveal } from '@/components/questoes/answer';
import { FinishButton, ListPdfButton, RestartButton } from '@/components/questoes/list-client';
import { MathFit } from '@/components/questoes/math-fit';
import { QImage } from '@/components/questoes/q-image';
import { QuestionBody } from '@/components/questoes/question-body';
import { Badge, Card, PageHeader } from '@/components/ui';
import { sql } from '@/lib/db';
import { source } from '@/lib/list-html';
import { canSeeList, getList, questionsOf } from '@/lib/question-lists';
import { altImagesToShow, blankAlternatives, type QImg } from '@/lib/question-types';
import { rich } from '@/lib/rich';
import { requireViewer } from '@/lib/session';

export const metadata: Metadata = { title: 'Lista de questões' };

/** Lista mandada pelo professor: responder no celular (correção na hora ou no fim do teste) e baixar em PDF. */
export default async function ListaAluno({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireViewer();
  const list = await getList((await params).id);
  if (!list || !(await canSeeList(viewer, list))) notFound();
  const [qs, resp, fin] = await Promise.all([
    questionsOf(list),
    sql.query<{ question_id: string; letter: string; correct: boolean }>(
      `select question_id, letter, correct from list_responses where list_id = $1 and user_id = $2`,
      [list.id, viewer.userId],
    ),
    sql.one(`select 1 from list_finishes where list_id = $1 and user_id = $2`, [list.id, viewer.userId]),
  ]);
  const by = new Map(resp.map((r) => [r.question_id, r]));
  const teacher = viewer.isAdmin;
  const test = list.mode === 'teste' && !teacher;
  const finished = Boolean(fin);
  const reveal = (q: (typeof qs)[number]) => !test || finished || teacher;
  const counted = qs.filter((q) => q.status !== 'anulada');
  const right = counted.filter((q) => by.get(q.id)?.correct).length;

  return (
    <div className="mx-auto max-w-3xl min-w-0">
      <Link href="/questoes" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Questões
      </Link>
      <PageHeader
        eyebrow={list.mode === 'teste' ? 'Teste' : 'Lista de questões'}
        title={list.title}
        actions={
          <>
            <ListPdfButton id={list.id} title={list.title} />
            {!test && by.size > 0 && <RestartButton id={list.id} />}
          </>
        }
      />
      <div className="mb-5 flex flex-wrap gap-1.5">
        <Badge>{qs.length} questões</Badge>
        <Badge tone="brand">
          {by.size} de {qs.length} respondidas
        </Badge>
        {(!test || finished) && by.size > 0 && (
          <Badge tone="success">
            {right} de {counted.length} certas
          </Badge>
        )}
      </div>
      {test && finished && (
        <Card className="mb-5 p-4 text-center">
          <p className="text-sm text-muted">Resultado do teste</p>
          <p className="text-3xl font-extrabold text-ink">
            {right}/{counted.length}
          </p>
          <p className="text-xs text-muted">{counted.length ? Math.round((right / counted.length) * 100) : 0}% de acerto</p>
        </Card>
      )}

      <MathFit />
      <div className="space-y-8">
        {qs.map((q, i) => {
          const mine = by.get(q.id);
          const alts: AltView[] = q.alternativas.map((a) => ({ letra: a.letra, html: rich(a.texto), imagem: a.imagem ?? null }));
          const altImgs: QImg[] = altImagesToShow(q);
          const show = reveal(q) && (mine || teacher || (test && finished));
          const initial: Reveal | null = show
            ? {
                letter: mine?.letter ?? '',
                gabarito: q.status === 'anulada' ? '' : q.gabarito,
                correct: q.status === 'anulada' || !mine ? null : mine.correct,
                resolucao: rich(q.resolucao),
              }
            : null;
          return (
            <section key={q.id} id={`q${i + 1}`} className="scroll-mt-20 space-y-4">
              <p className="text-xs font-bold tracking-wider text-brand uppercase">
                Questão {i + 1}
                {source(q) && <span className="font-semibold text-muted normal-case"> · {source(q)}</span>}
                {q.status === 'anulada' && <span className="text-danger normal-case"> · anulada pelo INEP</span>}
              </p>
              <QuestionBody blocos={q.blocos} />
              {altImgs.map((img, k) => (
                <QImage key={k} img={img} />
              ))}
              <Answer
                key={`${q.id}-${show ? 'r' : 'a'}`}
                id={q.id}
                alts={alts}
                status={q.status}
                initial={initial}
                teacher={teacher}
                compact={blankAlternatives(q)}
                listId={list.id}
                test={test && !finished}
                savedLetter={test && !finished ? (mine?.letter ?? '') : ''}
              />
            </section>
          );
        })}
      </div>
      {test && !finished && qs.length > 0 && (
        <div className="mt-8">
          <FinishButton id={list.id} answered={by.size} total={qs.length} />
        </div>
      )}
    </div>
  );
}
