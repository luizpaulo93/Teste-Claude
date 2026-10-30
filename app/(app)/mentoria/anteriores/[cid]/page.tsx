import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CycleView } from '@/components/mentoria/cycle-view';
import { emailKey } from '@/lib/db';
import { todayBR } from '@/lib/mentoria';
import { getCycle } from '@/lib/mentoria-cycles';
import { requireViewer } from '@/lib/session';

export default async function MentoriaPreviousCycle({ params }: { params: Promise<{ cid: string }> }) {
  const viewer = await requireViewer();
  const cycle = await getCycle((await params).cid);
  if (!cycle || cycle.mentoria_id !== emailKey(viewer.email)) notFound();
  return (
    <div className="space-y-3">
      <Link href="/mentoria/anteriores" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Ciclos anteriores
      </Link>
      <CycleView cycle={cycle} today={todayBR()} />
    </div>
  );
}
