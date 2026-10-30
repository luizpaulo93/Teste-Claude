import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CycleView } from '@/components/mentoria/cycle-view';
import { todayBR } from '@/lib/mentoria';
import { getCycle } from '@/lib/mentoria-cycles';

export default async function MentoradoPreviousCycle({ params }: { params: Promise<{ id: string; cid: string }> }) {
  const { id, cid } = await params;
  const mid = decodeURIComponent(id);
  const cycle = await getCycle(cid);
  if (!cycle || cycle.mentoria_id !== mid) notFound();
  return (
    <div className="space-y-3">
      <Link href={`/admin/mentoria/${encodeURIComponent(mid)}/anteriores`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Ciclos anteriores
      </Link>
      <CycleView cycle={cycle} today={todayBR()} />
    </div>
  );
}
