import { notFound } from 'next/navigation';
import { ErrorNotebook } from '@/components/mentoria/error-notebook';
import { todayBR } from '@/lib/mentoria';
import { getMentoria, openErrors } from '@/lib/mentoria-data';

export default async function AdminMentoradoErrors({ params }: { params: Promise<{ id: string }> }) {
  const m = await getMentoria(decodeURIComponent((await params).id));
  if (!m) notFound();
  return <ErrorNotebook errors={await openErrors(m.id)} today={todayBR()} mentoriaId={m.id} />;
}
