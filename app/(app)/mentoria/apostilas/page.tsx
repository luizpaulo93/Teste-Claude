import type { Metadata } from 'next';
import { ApostilasFolder } from '@/components/mentoria/apostilas';
import { emailKey } from '@/lib/db';
import { todayBR } from '@/lib/mentoria';
import { blocksOf, spacesOfMentoria } from '@/lib/mentoria-blocks';
import { getMentoria } from '@/lib/mentoria-data';
import { requireViewer } from '@/lib/session';

export const metadata: Metadata = { title: 'Apostilas · Mentoria' };

export default async function MentoriaApostilas() {
  const viewer = await requireViewer();
  const m = await getMentoria(emailKey(viewer.email));
  if (!m) return null;
  const blocks = await blocksOf(await spacesOfMentoria(m.id));
  return <ApostilasFolder groups={blocks} today={todayBR()} />;
}
