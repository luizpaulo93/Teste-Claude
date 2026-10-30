import type { Metadata } from 'next';
import { MatrizView } from '@/components/mentoria/matriz-view';
import { emailKey } from '@/lib/db';
import { getMentoria, topicStatus } from '@/lib/mentoria-data';
import { requireViewer } from '@/lib/session';

export const metadata: Metadata = { title: 'Conteúdos do ENEM · Mentoria' };

export default async function MentoriaContents() {
  const viewer = await requireViewer();
  const m = await getMentoria(emailKey(viewer.email));
  if (!m) return null;
  return <MatrizView initial={await topicStatus(m.id)} />;
}
