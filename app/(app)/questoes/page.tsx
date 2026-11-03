import { ChevronLeft, ChevronRight, FileQuestion } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { QuestionFilters } from '@/components/questoes/filters';
import { Badge, buttonClass, Card, EmptyState, PageHeader } from '@/components/ui';
import { sql } from '@/lib/db';
import { DIFFICULTY, difficultyOf } from '@/lib/question-types';
import { filterOptions, filterQuery, listQuestions, paperLabel, readFilters } from '@/lib/questions';
import { requireViewer } from '@/lib/session';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Questões' };

const PER = 30;
// texto do enunciado sem Markdown/LaTeX, só para a prévia da lista
const plain = (s: string) =>
  s
    .replace(/\$([^$]*)\$/g, '$1')
    .replace(/\\[a-z]+\{([^{}]*)\}/gi, '$1')
    .replace(/[*_`#>\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export default async function QuestoesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireViewer();
  if (!viewer.isMember && !viewer.isAdmin) redirect('/');
  const sp = await searchParams;
  const f = readFilters(sp);
  const page = Math.max(1, Number(sp.page) || 1);
  const [{ items, total }, opts, mine] = await Promise.all([
    listQuestions(f, viewer.userId, page, PER),
    filterOptions(),
    sql.one<{ n: number; ok: number }>(`select count(*)::int as n, count(*) filter (where correct)::int as ok from question_answers where user_id = $1`, [
      viewer.userId,
    ]),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER));
  const qs = (extra: Record<string, string> = {}) => filterQuery(f, extra);

  return (
    <>
      <PageHeader
        eyebrow="Banco de questões"
        title="Questões"
        actions={
          viewer.isAdmin ? (
            <Link href="/admin/questoes" className={buttonClass('secondary', 'sm')}>
              Importar provas
            </Link>
          ) : mine && mine.n > 0 ? (
            <Badge className="max-w-full whitespace-normal break-words" tone="brand">
              {mine.n} respondidas · {Math.round((mine.ok / mine.n) * 100)}% de acerto
            </Badge>
          ) : undefined
        }
      />

      {opts.papers.length === 0 ? (
        <EmptyState
          icon={<FileQuestion className="size-5" />}
          title="Nenhuma questão ainda"
          description={viewer.isAdmin ? 'Importe uma prova em Admin › Questões.' : 'Em breve.'}
        />
      ) : (
        <>
          <QuestionFilters value={f} disc={opts.disc} papers={opts.papers.map((p) => ({ id: p.id, label: paperLabel(p) }))} />
          <p className="mt-4 mb-2 text-xs text-muted">
            {total} {total === 1 ? 'questão' : 'questões'}
          </p>
          {items.length ? (
            <ul className="space-y-2">
              {items.map((it, idx) => {
                const dif = difficultyOf(it.param_b);
                return (
                  <li key={it.id}>
                    <Link href={`/questoes/${it.id}${qs()}`}>
                      <Card className="flex gap-3 p-3.5 transition hover:border-brand/40">
                        <span
                          className={cn(
                            'grid size-10 shrink-0 place-items-center rounded-xl text-sm font-bold',
                            it.correct === true ? 'bg-success/12 text-success' : it.correct === false ? 'bg-danger/12 text-danger' : 'bg-surface-3 text-ink-2',
                          )}
                        >
                          {(page - 1) * PER + idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-bold text-ink">
                            {it.disciplina} · {it.assunto_geral}
                          </p>
                          {it.assunto_especifico && <p className="truncate text-xs text-ink-2">{it.assunto_especifico}</p>}
                          <p className="mt-1 line-clamp-2 text-xs text-muted">{plain(it.snippet)}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            <Badge className="max-w-full whitespace-normal break-words">
                              {[it.exame, it.ano].filter(Boolean).join(' ')} · {it.aplicacao.replace(/^Aplicação\s+/i, '')}
                            </Badge>
                            {it.habilidade && <Badge className="max-w-full whitespace-normal break-words">{it.habilidade}</Badge>}
                            {dif && (
                              <Badge
                                className="max-w-full whitespace-normal break-words"
                                tone={dif === 'dificil' ? 'danger' : dif === 'media' ? 'warning' : 'success'}
                              >
                                {DIFFICULTY.find((d) => d.key === dif)!.label}
                              </Badge>
                            )}
                            {it.status === 'anulada' && (
                              <Badge className="max-w-full whitespace-normal break-words" tone="danger">
                                Anulada
                              </Badge>
                            )}
                          </div>
                        </div>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={<FileQuestion className="size-5" />} title="Nenhuma questão com esses filtros" />
          )}
          {pages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              {page > 1 && (
                <Link href={`/questoes${qs({ page: String(page - 1) })}`} className={buttonClass('secondary', 'sm')}>
                  <ChevronLeft className="size-4" /> Anterior
                </Link>
              )}
              <span className="text-xs text-muted">
                {page} de {pages}
              </span>
              {page < pages && (
                <Link href={`/questoes${qs({ page: String(page + 1) })}`} className={buttonClass('secondary', 'sm')}>
                  Próxima <ChevronRight className="size-4" />
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
