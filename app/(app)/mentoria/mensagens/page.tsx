import type { Metadata } from 'next';
import { MentoriaChat } from '@/components/mentoria/chat';
import { emailKey } from '@/lib/db';
import { getMentoria, messages } from '@/lib/mentoria-data';
import { requireViewer } from '@/lib/session';

export const metadata: Metadata = { title: 'Mentor · Mentoria' };

export default async function MentoriaMessages() {
  const viewer = await requireViewer();
  const m = await getMentoria(emailKey(viewer.email));
  if (!m) return null;
  return <MentoriaChat messages={await messages(m.id)} asMentor={false} />;
}
