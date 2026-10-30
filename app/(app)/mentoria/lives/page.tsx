import type { Metadata } from 'next';
import { SpaceLives } from '@/components/mentoria/space-lives';
import { spacesFor } from '@/lib/mentoria-space';
import { requireViewer } from '@/lib/session';

export const metadata: Metadata = { title: 'Lives · Mentoria' };

export default async function MentoriaLives() {
  const viewer = await requireViewer();
  const spaces = await spacesFor(viewer);
  return <SpaceLives spaces={spaces.map((s) => s.key)} />;
}
