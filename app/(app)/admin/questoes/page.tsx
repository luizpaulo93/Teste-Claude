import { FileQuestion } from 'lucide-react';
import type { Metadata } from 'next';
import { EmptyState, PageHeader, SectionHeader } from '@/components/ui';
import { sql } from '@/lib/db';
import { paperLabel, type Paper } from '@/lib/questions';
import { requireAdmin } from '@/lib/session';
import { QuestionsHub } from './hub';
import { PapersList } from './papers-list';

export const metadata: Metadata = { title: 'Questões · Admin' };

export default async function AdminQuestoes() {
  await requireAdmin();
  const papers = await sql.query<Paper & { valid: number; answers: number; no_res: number }>(
    `select p.*, (select count(*)::int from questions q where q.paper_id = p.id and q.status <> 'anulada') as valid,
            (select count(*)::int from questions q where q.paper_id = p.id and q.resolucao = '') as no_res,
            (select count(*)::int from question_answers a join questions q on q.id = a.question_id where q.paper_id = p.id) as answers
       from exam_papers p order by p.ano desc nulls last, p.id`,
  );
  // questão de cada problema (para abrir direto na edição)
  const withProblems = papers.filter((p) => p.problems?.length).map((p) => p.id);
  const qids = withProblems.length
    ? await sql.query<{ paper_id: string; numero: number; id: string }>(`select paper_id, numero, id from questions where paper_id = any($1)`, [withProblems])
    : [];
  const qidOf = new Map(qids.map((r) => [`${r.paper_id}#${r.numero}`, r.id]));
  return (
    <>
      <PageHeader eyebrow="Banco de questões" title="Questões" />
      <section className="mb-8">
        <QuestionsHub />
      </section>

      <section>
        <SectionHeader title={`Provas no app (${papers.length})`} href="/questoes" link="Abrir banco de questões" />
        {papers.length ? (
          <PapersList
            papers={papers.map((p) => ({
              id: p.id,
              label: paperLabel(p),
              caderno: p.caderno,
              total: p.total,
              answers: p.answers,
              images: p.images,
              missing: p.missing_images,
              noRes: p.no_res,
              problems: (p.problems ?? []).map((x) => ({ ...x, qid: qidOf.get(`${p.id}#${x.n}`) ?? null })),
            }))}
          />
        ) : (
          <EmptyState icon={<FileQuestion className="size-5" />} title="Nenhuma prova ainda" description="Importe o provas.json com as imagens." />
        )}
      </section>
    </>
  );
}
