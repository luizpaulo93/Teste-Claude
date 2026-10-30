import type { Metadata } from 'next';
import { ErrorNotebook } from '@/components/mentoria/error-notebook';
import { emailKey } from '@/lib/db';
import { todayBR } from '@/lib/mentoria';
import { getMentoria, openErrors } from '@/lib/mentoria-data';
import { requireViewer } from '@/lib/session';

export const metadata: Metadata = { title: 'Caderno de erros · Mentoria' };

export default async function MentoriaErrors() {
  const viewer = await requireViewer();
  const m = await getMentoria(emailKey(viewer.email));
  if (!m) return null;
  return <ErrorNotebook errors={await openErrors(m.id)} today={todayBR()} />;
}
