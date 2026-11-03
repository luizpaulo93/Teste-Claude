import { FileQuestion, ImageOff } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Card, EmptyState, PageHeader, SectionHeader } from '@/components/ui';
import { sql } from '@/lib/db';
import { paperLabel, type Paper } from '@/lib/questions';
import { requireAdmin } from '@/lib/session';
import { DeletePaper, Importer } from './importer';

export const metadata: Metadata = { title: 'Questões · Admin' };

export default async function AdminQuestoes() {
  await requireAdmin();
  const papers = await sql.query<Paper & { valid: number; answers: number }>(
    `select p.*, (select count(*)::int from questions q where q.paper_id = p.id and q.status <> 'anulada') as valid,
            (select count(*)::int from question_answers a join questions q on q.id = a.question_id where q.paper_id = p.id) as answers
       from exam_papers p order by p.ano desc nulls last, p.id`,
  );
  return (
    <>
      <PageHeader eyebrow="Banco de questões" title="Questões" />
      <section className="mb-8">
        <SectionHeader title="Importar provas" />
        <Importer />
      </section>

      <section>
        <SectionHeader title={`Provas no app (${papers.length})`} href="/questoes" link="Abrir banco de questões" />
        {papers.length ? (
          <div className="space-y-2">
            {papers.map((p) => (
              <Card key={p.id} className="flex flex-wrap items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <Link href={`/questoes?prova=${encodeURIComponent(p.id)}`} className="block truncate text-sm font-bold text-ink hover:text-brand">
                    {paperLabel(p)}
                  </Link>
                  <p className="mt-0.5 truncate text-[11px] text-muted">
                    {p.caderno ? `Caderno ${p.caderno} · ` : ''}
                    {p.id}
                  </p>
                </div>
                <Badge>{p.total} questões</Badge>
                {p.answers > 0 && <Badge tone="brand">{p.answers} respostas</Badge>}
                {p.missing_images > 0 ? (
                  <Badge tone="warning">
                    <ImageOff className="size-3" /> faltam {p.missing_images} imagens
                  </Badge>
                ) : (
                  p.images > 0 && <Badge tone="success">{p.images} imagens</Badge>
                )}
                <DeletePaper id={p.id} />
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState icon={<FileQuestion className="size-5" />} title="Nenhuma prova ainda" description="Importe o provas.json com as imagens." />
        )}
      </section>
    </>
  );
}
