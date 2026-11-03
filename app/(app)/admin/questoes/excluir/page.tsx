import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/ui';
import { requireAdmin } from '@/lib/session';
import { BulkDelete } from './bulk-delete';

export const metadata: Metadata = { title: 'Excluir questões · Admin' };

export default async function ExcluirQuestoes() {
  await requireAdmin();
  return (
    <>
      <Link href="/admin/questoes" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Questões
      </Link>
      <PageHeader eyebrow="Banco de questões" title="Excluir questões" />
      <BulkDelete />
    </>
  );
}
