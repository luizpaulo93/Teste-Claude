import type { Metadata } from 'next';
import { CycleList } from '@/components/mentoria/cycle-view';
import { emailKey } from '@/lib/db';
import { cyclesOf } from '@/lib/mentoria-cycles';
import { requireViewer } from '@/lib/session';

export const metadata: Metadata = { title: 'Ciclos anteriores · Mentoria' };

export default async function MentoriaPrevious() {
  const viewer = await requireViewer();
  return <CycleList list={await cyclesOf(emailKey(viewer.email))} base="/mentoria/anteriores" />;
}
