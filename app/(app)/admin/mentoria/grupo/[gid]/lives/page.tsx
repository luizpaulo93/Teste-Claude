import { notFound } from 'next/navigation';
import { SpaceLives } from '@/components/mentoria/space-lives';
import { getGroup } from '@/lib/mentoria-space';

export default async function GroupLives({ params }: { params: Promise<{ gid: string }> }) {
  const g = await getGroup((await params).gid);
  if (!g) notFound();
  return <SpaceLives spaces={[`g:${g.id}`]} admin />;
}
