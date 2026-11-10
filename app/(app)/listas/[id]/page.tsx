import { ArrowLeft, Lock } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Answer, type AltView, type Reveal } from '@/components/questoes/answer';
import { FinishButton, RestartButton } from '@/components/questoes/list-client';
import { ListReport } from '@/components/questoes/list-report';
import { ListNav } from '@/components/questoes/list-nav';
import { ListDownloads } from '@/components/questoes/my-lists';
import { MathFit } from '@/components/questoes/math-fit';
import { QImage } from '@/components/questoes/q-image';
import { QuestionBody } from '@/components/questoes/question-body';
import { Badge, Card, PageHeader } from '@/components/ui';
import { sql } from '@/lib/db';
import { source } from '@/lib/list-html';
import { canSeeList, getList, questionsOf, resolutionOpen } from '@/lib/question-lists';
import { altImagesToShow, blankAlternatives, type QImg } from '@/lib/question-types';
import { rich } from '@/lib/rich';
import { requireViewer } from '@/lib/session';

export const metadata: Metadata = { title: 'Lista de questões' };

/**
 * Lista ou teste: o aluno marca as questões e finaliza (botão no quadro das questões); aí vê o que acertou e errou.
 * A resolução do teste do professor só aparece depois que ele liberar.
 * ?sim=<id>: o simulado montado desta lista, com as respostas que o aluno deu no cartão-resposta.
 */
export default async function ListaAluno({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sim?: string; de?: string }> }) {
  const viewer = await requireViewer();
  const list = await getList((await params).id);
  if (!list) notFound();
  const { sim: simId, de } = await searchParams;
  const fromPerf = de === 'desempenho';
  // simulado desta lista que o aluno já entregou (com resultado liberado)
  const sim = simId
    ? await sql.one<{ id: string; title: string; resolution_released: boolean; answers: string }>(
        `select s.id, s.title, s.resolution_released, x.answers
           from simulados s join simulado_submissions x on x.simulado_id = s.id and x.user_id = $3 and x.status = 'completed'
          where s.id = $1 and s.list_id = $2 and s.results_released`,
        [simId, list.id, viewer.userId],
      )
    : null;
  if (!sim && !(await canSeeList(viewer, list))) notFound();

  const [qs, resp, fin] = await Promise.all([
    questionsOf(list),
    sim
      ? Promise.resolve([])
      : sql.query<{ question_id: string; letter: string; correct: boolean }>(
          `select question_id, letter, correct from list_responses where list_id = $1 and user_id = $2`,
          [list.id, viewer.userId],
        ),
    sim
      ? Promise.resolve(null)
      : sql.one<{ open: boolean; attempts: number; ok: number | null; total: number | null }>(
          `select open, attempts, ok, total from list_finishes where list_id = $1 and user_id = $2`,
          [list.id, viewer.userId],
        ),
  ]);
  const by = new Map(resp.map((r) => [r.question_id, r]));
  if (sim) {
    // o cartão-resposta segue a ordem das questões válidas da lista (as mesmas do gabarito do simulado)
    const valid = qs.filter((q) => q.status !== 'anulada' && /^[A-E]$/.test(q.gabarito));
    valid.forEach((q, i) => {
      const l = (sim.answers[i] ?? '').toUpperCase();
      if (/^[A-E]$/.test(l)) by.set(q.id, { question_id: q.id, letter: l, correct: l === q.gabarito });
    });
  }
  const test = list.mode === 'teste' || Boolean(sim);
  // fin.open = refazendo (a 1ª tentativa já está guardada e é a que conta nas estatísticas)
  const finished = Boolean(sim) || Boolean(fin && !fin.open);
  const retry = fin && (fin.open || fin.attempts > 1) ? fin : null;
  // resolução: livre na lista comum e nas listas do aluno; no teste do professor, só depois de liberar
  const resOpen = sim ? sim.resolution_released || Boolean(list.resolution_released) : resolutionOpen(list);
  const showResolution = !test || (finished && resOpen);
  const counted = qs.filter((q) => q.status !== 'anulada');
  const right = counted.filter((q) => by.get(q.id)?.correct).length;
  const mineList = Boolean(list.owner_id) && list.owner_id === viewer.userId;

  return (
    <div className="mx-auto max-w-3xl min-w-0">
      <Link
        href={sim || fromPerf ? '/desempenho' : '/questoes'}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" /> {sim || fromPerf ? 'Desempenho' : viewer.isAdmin ? 'Questões' : 'Exercícios'}
      </Link>
      <PageHeader
        eyebrow={sim ? 'Simulado' : list.mode === 'teste' ? (mineList ? 'Minha lista' : 'Teste') : 'Lista de questões'}
        title={sim ? sim.title : list.title}
        actions={!sim && ((test && finished) || (!test && by.size > 0)) ? <RestartButton id={list.id} /> : undefined}
      />
      {/* baixar e navegação (voltar, todas as questões e finalizar, avançar): presa no alto ao rolar */}
      <div className="sticky top-14 z-20 -mx-4 mb-4 flex items-center gap-2 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:px-10">
        {!sim && <ListDownloads id={list.id} title={list.title} resolutions={!test || mineList || (finished && resOpen)} />}
        <span className="flex-1" />
        <ListNav
          items={qs.map((q, i) => {
            const r = by.get(q.id);
            return {
              n: i + 1,
              id: q.id,
              anulada: q.status === 'anulada',
              state: !r ? 'nao' : test && !finished ? 'respondida' : r.correct ? 'certa' : 'errada',
            };
          })}
          finishId={test && !finished ? list.id : undefined}
        />
      </div>
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
          <p className="text-sm text-muted">Resultado</p>
          <p className="text-3xl font-extrabold text-ink">
            {right}/{counted.length}
          </p>
          <p className="text-xs text-muted">
            {counted.length ? Math.round((right / counted.length) * 100) : 0}% de acerto · {counted.length - by.size} em branco
          </p>
        </Card>
      )}
      {retry && (
        <div className="mb-5 rounded-2xl border border-brand/30 bg-brand/8 p-3 text-sm text-ink-2">
          <strong className="text-ink">{fin!.open ? `Tentativa ${fin!.attempts}` : `Você já fez ${fin!.attempts} tentativas`}</strong> · só a 1ª conta nas
          estatísticas
          {fin!.ok !== null && fin!.total ? ` (${fin!.ok}/${fin!.total} acertos)` : ''}.
        </div>
      )}
      {test && finished && !resOpen && (
        <div className="mb-5 flex items-center gap-2 rounded-2xl border border-line bg-surface p-3 text-sm text-ink-2">
          <Lock className="size-4 shrink-0 text-muted" /> A resolução das questões aparece aqui quando o professor liberar.
        </div>
      )}
      {test && !finished && (
        <p className="mb-5 text-xs text-muted">Marque as respostas e toque em Finalizar (no quadro das questões) para ver o que acertou e errou.</p>
      )}

      <MathFit />
      <div className="space-y-8">
        {qs.map((q, i) => {
          const mine = by.get(q.id);
          const alts: AltView[] = q.alternativas.map((a) => ({ letra: a.letra, html: rich(a.texto), imagem: a.imagem ?? null }));
          const altImgs: QImg[] = altImagesToShow(q);
          const show = test ? finished : Boolean(mine);
          const initial: Reveal | null = show
            ? {
                letter: mine?.letter ?? '',
                gabarito: q.status === 'anulada' ? '' : q.gabarito,
                correct: q.status === 'anulada' || !mine ? null : mine.correct,
                resolucao: showResolution ? rich(q.resolucao) : '',
              }
            : null;
          return (
            <section key={q.id} id={`q${i + 1}`} className="scroll-mt-32 space-y-4 lg:scroll-mt-20">
              <p className="text-xs font-bold tracking-wider text-brand uppercase">
                Questão {i + 1}
                {source(q) && <span className="font-semibold text-muted normal-case"> · {source(q)}</span>}
                {q.status === 'anulada' && <span className="text-danger normal-case"> · anulada{q.vestibular === 'ENEM' ? ' pelo INEP' : ''}</span>}
                {test && finished && q.status !== 'anulada' && !mine && <span className="text-warning normal-case"> · em branco</span>}
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
                teacher={false}
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
          <FinishButton />
        </div>
      )}
      {/* relatório: na lista comum, conforme vai respondendo; no teste, depois de finalizar */}
      {by.size > 0 && (!test || finished) && (
        <ListReport
          qs={counted.map((q) => ({
            n: qs.indexOf(q) + 1,
            disciplina: q.disciplina,
            assunto: q.assunto_geral,
            especifico: q.assunto_especifico,
            answered: by.has(q.id),
            correct: Boolean(by.get(q.id)?.correct),
          }))}
        />
      )}
    </div>
  );
}
