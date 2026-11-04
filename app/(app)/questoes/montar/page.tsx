import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireViewer } from '@/lib/session';
import { StudentBuilder } from './student-builder';

export const metadata: Metadata = { title: 'Escolher questões' };

export default async function MontarLista() {
  const viewer = await requireViewer();
  if (!viewer.isMember && !viewer.isAdmin) redirect('/');
  return <StudentBuilder />;
}
