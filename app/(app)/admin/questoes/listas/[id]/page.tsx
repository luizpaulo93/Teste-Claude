import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import { allTemplates, getList, itemsOf } from '@/lib/question-lists';
import { requireAdmin } from '@/lib/session';
import { liveAudienceOptions } from '../../../ao-vivo/options';
import { Builder } from './builder';

export const metadata: Metadata = { title: 'Montar lista · Admin' };

export default async function ListaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const list = id === 'nova' ? null : await getList(id);
  if (id !== 'nova' && !list) notFound();
  const [items, templates, { options }, simulados] = await Promise.all([
    list ? itemsOf(list.question_ids) : Promise.resolve([]),
    allTemplates(),
    liveAudienceOptions(),
    list ? sql.query<{ id: string; title: string }>(`select id, title from simulados where list_id = $1`, [list.id]) : Promise.resolve([]),
  ]);
  return (
    <Builder
      key={list?.id ?? 'nova'}
      initial={{
        id: list?.id ?? '',
        title: list?.title ?? '',
        count: items.length,
        mode: list?.mode ?? 'lista',
        audience: list?.audience ?? [],
        lesson_ids: list?.lesson_ids ?? [],
        template_id: list?.template_id ?? null,
      }}
      items={items}
      templates={templates}
      options={options}
      simulados={simulados}
    />
  );
}
