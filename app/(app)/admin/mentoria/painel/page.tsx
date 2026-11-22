import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { MentorPanelView } from '@/components/mentoria/mentor-panel';
import { PageHeader } from '@/components/ui';
import { mentorPanel } from '@/lib/mentoria-panel';

export const metadata: Metadata = { title: 'Painel da mentoria · Admin' };

/** Painel do mentor: quem está ativo, quem acerta, quem erra, quem sumiu, quem melhorou e onde atacar. */
export default async function MentoriaPanelPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const days = (await searchParams).dias === '7' ? 7 : 30;
  const data = await mentorPanel(days);
  return (
    <div className="space-y-4">
      <Link href="/admin/mentoria" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Mentoria
      </Link>
      <PageHeader title="Painel da mentoria" subtitle="Tudo dos mentorados num lugar: atividade, acertos, evolução e os assuntos que precisam de atenção." />
      <MentorPanelView data={data} />
    </div>
  );
}
