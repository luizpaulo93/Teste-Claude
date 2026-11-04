import { ChevronLeft, ChevronRight, FileQuestion, ListChecks } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { QuestionFilters } from '@/components/questoes/filters';
import { Badge, buttonClass, Card, EmptyState, PageHeader, SectionHeader } from '@/components/ui';
import { sql } from '@/lib/db';
import { DIFFICULTY, difficultyOf } from '@/lib/question-types';
import { filterOptions, filterQuery, listQuestions, paperLabel, readFilters } from '@/lib/questions';
import { listsForViewer, myLists as myOwnLists } from '@/lib/question-lists';
import { ListTypeCards, MyListCard } from '@/components/questoes/my-lists';
import { requireViewer } from '@/lib/session';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Exercícios' };

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
  const [{ items, total }, opts, mine, myLists, done, own] = await Promise.all([
    listQuestions(f, viewer.userId, page, PER),
    filterOptions(),
    sql.one<{ n: number; ok: number }>(`select count(*)::int as n, count(*) filter (where correct)::int as ok from question_answers where user_id = $1`, [
      viewer.userId,
    ]),
    viewer.isAdmin ? Promise.resolve([]) : listsForViewer(viewer),
    sql.query<{ list_id: string; n: number }>(`select list_id, count(*)::int as n from list_responses where user_id = $1 group by 1`, [viewer.userId]),
    myOwnLists(viewer.userId),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER));
  const qs = (extra: Record<string, string> = {}) => filterQuery(f, extra);

  return (
    <>
      <PageHeader
        eyebrow={viewer.isAdmin ? 'Banco de questões' : 'Banco de exercícios'}
        title={viewer.isAdmin ? 'Questões' : 'Exercícios'}
        actions={
          !viewer.isAdmin && mine && mine.n > 0 ? (
            <Badge className="max-w-full whitespace-normal break-words" tone="brand">
              {mine.n} respondidas · {Math.round((mine.ok / mine.n) * 100)}% de acerto
            </Badge>
          ) : undefined
        }
      />

      {/* montar lista: aleatória ou escolhendo; embaixo, as listas já montadas */}
      <section className="mb-8 space-y-3">
        <ListTypeCards />
        {own.length > 0 && (
          <div className="space-y-2 pt-2">
            <SectionHeader title="Minhas listas" />
            {own.map((l) => (
              <MyListCard key={l.id} list={{ id: l.id, title: l.title, total: l.question_ids.length, answered: l.answered, right: l.right }} />
            ))}
          </div>
        )}
      </section>

      {myLists.length > 0 && (
        <section className="mb-8">
          <SectionHeader title="Listas para você" icon={<ListChecks className="size-5 text-success" />} />
          <div className="grid gap-2 sm:grid-cols-2">
            {myLists.map((l) => {
              const n = done.find((d) => d.list_id === l.id)?.n ?? 0;
              return (
                <Link key={l.id} href={`/listas/${l.id}`}>
                  <Card className="flex h-full items-center gap-3 p-3.5 transition hover:border-brand/40">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success/12 text-success">
                      <ListChecks className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold break-words text-ink">{l.title}</span>
                      <span className="block text-xs text-muted">
                        {l.mode === 'teste' ? 'Teste' : 'Lista'} · {n} de {l.question_ids.length} respondidas
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted" />
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {opts.papers.length === 0 ? (
        <EmptyState
          icon={<FileQuestion className="size-5" />}
          title="Nenhuma questão ainda"
          description={viewer.isAdmin ? 'Importe uma prova em Admin › Questões.' : 'Em breve.'}
        />
      ) : (
        <>
          {f.topico && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-brand/30 bg-brand/8 p-3 text-sm">
              <span className="min-w-0 flex-1 break-words text-ink">
                Assunto do cronograma: <strong>{f.topico}</strong>
              </span>
              <Link href={`/questoes${filterQuery({ ...f, topico: '' })}`} className="text-xs font-semibold text-brand">
                Ver todas
              </Link>
            </div>
          )}
          <QuestionFilters value={f} rows={opts.rows} papers={opts.papers.map((p) => ({ id: p.id, label: paperLabel(p) }))} total={total} />
          <div className="mb-3" />
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
