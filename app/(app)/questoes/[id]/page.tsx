import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Answer, type AltView, type Reveal } from '@/components/questoes/answer';
import { MathFit } from '@/components/questoes/math-fit';
import { QImage } from '@/components/questoes/q-image';
import { QuestionBody } from '@/components/questoes/question-body';
import { Badge, buttonClass, Card } from '@/components/ui';
import { sql } from '@/lib/db';
import { DIFFICULTY, difficultyOf, type QImg, altImagesToShow, blankAlternatives } from '@/lib/question-types';
import { filterQuery, getQuestion, neighbors, paperLabel, readFilters } from '@/lib/questions';
import { rich } from '@/lib/rich';
import { requireViewer } from '@/lib/session';

export const metadata: Metadata = { title: 'Questão' };

export default async function QuestaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requireViewer();
  if (!viewer.isMember && !viewer.isAdmin) redirect('/');
  const { id } = await params;
  const f = readFilters(await searchParams);
  const [q, nav, mine] = await Promise.all([
    getQuestion(id),
    neighbors(f, viewer.userId, id),
    sql.one<{ letter: string; correct: boolean }>(`select letter, correct from question_answers where user_id = $1 and question_id = $2`, [viewer.userId, id]),
  ]);
  if (!q) notFound();
  const qs = filterQuery(f);
  const teacher = viewer.isAdmin;
  const dif = difficultyOf(q.param_b);
  const alts: AltView[] = q.alternativas.map((a) => ({ letra: a.letra, html: rich(a.texto), imagem: a.imagem ?? null }));
  const altImgs: QImg[] = altImagesToShow(q);
  // gabarito e resolução só vão para a tela se o aluno já respondeu (ou no modo professor)
  const initial: Reveal | null =
    teacher || mine
      ? {
          letter: mine?.letter ?? '',
          gabarito: q.status === 'anulada' ? '' : q.gabarito,
          correct: q.status === 'anulada' ? null : teacher && !mine ? null : (mine?.correct ?? null),
          resolucao: rich(q.resolucao),
        }
      : null;

  return (
    <div className="mx-auto max-w-3xl min-w-0">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href={`/questoes${qs}`} className="flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> {viewer.isAdmin ? 'Questões' : 'Exercícios'}
        </Link>
      </div>

      <Card className="mb-4 space-y-2 p-4">
        <p className="text-xs font-semibold tracking-wider text-brand uppercase">
          {nav.pos > 0 ? `Questão ${nav.pos} de ${nav.total} · ` : ''}
          {paperLabel(q.paper)}
        </p>
        <p className="text-base font-bold text-ink">
          {q.disciplina} · {q.assunto_geral}
        </p>
        {q.assunto_especifico && <p className="text-sm text-ink-2">{q.assunto_especifico}</p>}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {q.area && <Badge className="max-w-full whitespace-normal break-words">{q.area}</Badge>}
          {q.competencia && <Badge className="max-w-full whitespace-normal break-words">Competência {q.competencia.replace(/^C/i, '')}</Badge>}
          {q.habilidade && <Badge className="max-w-full whitespace-normal break-words">Habilidade {q.habilidade.replace(/^H/i, '')}</Badge>}
          {dif && (
            <Badge className="max-w-full whitespace-normal break-words" tone={dif === 'dificil' ? 'danger' : dif === 'media' ? 'warning' : 'success'}>
              {DIFFICULTY.find((d) => d.key === dif)!.label}
              {teacher && q.param_b !== null ? ` · b ${q.param_b.toFixed(2)}` : ''}
            </Badge>
          )}
          {q.status === 'anulada' && (
            <Badge className="max-w-full whitespace-normal break-words" tone="danger">
              Questão anulada pelo INEP
            </Badge>
          )}
          {q.status === 'abandonado_na_calibracao' && (
            <Badge className="max-w-full whitespace-normal break-words" tone="warning">
              Item sem calibração (TRI)
            </Badge>
          )}
        </div>
      </Card>

      <div className="space-y-5">
        <QuestionBody blocos={q.blocos} />
        {altImgs.map((img, i) => (
          <QImage key={i} img={img} />
        ))}
        <MathFit />
        <Answer key={q.id} id={q.id} alts={alts} status={q.status} initial={initial} teacher={teacher} compact={blankAlternatives(q)} />
      </div>

      <div className="mt-6 flex items-center justify-between gap-2">
        {nav.prev ? (
          <Link href={`/questoes/${nav.prev}${qs}`} className={buttonClass('secondary', 'sm')}>
            <ChevronLeft className="size-4" /> Anterior
          </Link>
        ) : (
          <span />
        )}
        {nav.next && (
          <Link href={`/questoes/${nav.next}${qs}`} className={buttonClass('primary', 'sm')}>
            Próxima <ChevronRight className="size-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
