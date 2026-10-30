import type { Metadata } from 'next';
import { SpaceDoubts } from '@/components/mentoria/space-doubts';
import { spacesFor } from '@/lib/mentoria-space';
import { requireViewer } from '@/lib/session';

export const metadata: Metadata = { title: 'Dúvidas · Mentoria' };

export default async function MentoriaDoubts({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const viewer = await requireViewer();
  const spaces = await spacesFor(viewer);
  if (!spaces.length) return null;
  const want = (await searchParams).s;
  const space = spaces.find((s) => s.key === want)?.key ?? spaces[0].key;
  return <SpaceDoubts viewer={viewer} space={space} spaces={spaces} base="/mentoria/duvidas" />;
}
