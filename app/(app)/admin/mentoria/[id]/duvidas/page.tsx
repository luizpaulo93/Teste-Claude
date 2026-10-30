import { notFound } from 'next/navigation';
import { SpaceDoubts } from '@/components/mentoria/space-doubts';
import { getMentoria } from '@/lib/mentoria-data';
import { requireAdmin } from '@/lib/session';

export default async function AdminMentoradoDoubts({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireAdmin();
  const m = await getMentoria(decodeURIComponent((await params).id));
  if (!m) notFound();
  return <SpaceDoubts viewer={viewer} space={`m:${m.id}`} />;
}
