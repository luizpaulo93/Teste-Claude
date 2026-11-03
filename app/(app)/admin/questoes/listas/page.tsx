import { ArrowLeft, ListChecks, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonClass, EmptyState, PageHeader, SectionHeader } from '@/components/ui';
import { sql } from '@/lib/db';
import { allTemplates, type QList } from '@/lib/question-lists';
import { requireAdmin } from '@/lib/session';
import { liveAudienceOptions } from '../../ao-vivo/options';
import { ListCard, TemplatesManager } from './lists-client';

export const metadata: Metadata = { title: 'Listas · Admin' };

export default async function ListasPage() {
  await requireAdmin();
  const [lists, templates, sims, { options }] = await Promise.all([
    sql.query<QList & { valid: number }>(
      `select l.*, (select count(*)::int from questions q where q.id = any(l.question_ids)) as valid from question_lists l order by l.updated_at desc`,
    ),
    allTemplates(),
    sql.query<{ id: string; title: string; list_id: string; is_published: boolean }>(
      `select id, title, list_id, is_published from simulados where list_id is not null`,
    ),
    liveAudienceOptions(),
  ]);
  return (
    <>
      <Link href="/admin/questoes" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Questões
      </Link>
      <PageHeader
        eyebrow="Banco de questões"
        title="Listas"
        actions={
          <Link href="/admin/questoes/listas/nova" className={buttonClass('primary', 'sm')}>
            <Plus className="size-4" /> Nova lista
          </Link>
        }
      />
      <section className="mb-8">
        {lists.length ? (
          <div className="space-y-2">
            {lists.map((l) => (
              <ListCard
                key={l.id}
                list={{ id: l.id, title: l.title, count: l.valid, mode: l.mode, audience: l.audience, lesson_ids: l.lesson_ids }}
                template={templates.find((t) => t.id === l.template_id)?.name ?? ''}
                simulados={sims.filter((s) => s.list_id === l.id)}
                options={options}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<ListChecks className="size-5" />}
            title="Nenhuma lista ainda"
            action={
              <Link href="/admin/questoes/listas/nova" className={buttonClass('primary', 'sm')}>
                <Plus className="size-4" /> Montar a primeira lista
              </Link>
            }
          />
        )}
      </section>
      <section>
        <SectionHeader title="Cabeçalhos e rodapés" />
        <TemplatesManager templates={templates} />
      </section>
    </>
  );
}
