import { notFound } from 'next/navigation';
import { MentoriaChat } from '@/components/mentoria/chat';
import { getMentoria, messages } from '@/lib/mentoria-data';

export default async function AdminMentoradoMessages({ params }: { params: Promise<{ id: string }> }) {
  const m = await getMentoria(decodeURIComponent((await params).id));
  if (!m) notFound();
  return <MentoriaChat messages={await messages(m.id)} asMentor mentoriaId={m.id} />;
}
