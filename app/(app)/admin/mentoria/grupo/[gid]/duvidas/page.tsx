import { notFound } from 'next/navigation';
import { SpaceDoubts } from '@/components/mentoria/space-doubts';
import { getGroup } from '@/lib/mentoria-space';
import { requireAdmin } from '@/lib/session';

export default async function GroupDoubts({ params }: { params: Promise<{ gid: string }> }) {
  const viewer = await requireAdmin();
  const g = await getGroup((await params).gid);
  if (!g) notFound();
  return <SpaceDoubts viewer={viewer} space={`g:${g.id}`} />;
}
