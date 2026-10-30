import { notFound } from 'next/navigation';
import { MatrizView } from '@/components/mentoria/matriz-view';
import { getMentoria, topicStatus } from '@/lib/mentoria-data';

export default async function AdminMentoradoContents({ params }: { params: Promise<{ id: string }> }) {
  const m = await getMentoria(decodeURIComponent((await params).id));
  if (!m) notFound();
  return <MatrizView initial={await topicStatus(m.id)} mentoriaId={m.id} />;
}
