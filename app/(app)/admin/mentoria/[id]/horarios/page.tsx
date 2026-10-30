import { notFound } from 'next/navigation';
import { ScheduleForm } from '@/components/mentoria/schedule-form';
import { Card } from '@/components/ui';
import { getMentoria } from '@/lib/mentoria-data';

export default async function AdminMentoradoHours({ params }: { params: Promise<{ id: string }> }) {
  const m = await getMentoria(decodeURIComponent((await params).id));
  if (!m) notFound();
  return (
    <Card className="p-4 sm:p-6">
      {!m.diagnosed_at && <p className="mb-4 rounded-xl bg-warning/10 p-3 text-sm text-ink">O aluno ainda não informou os horários. Você pode preencher por ele.</p>}
      <ScheduleForm availability={m.availability} mentoriaId={m.id} />
    </Card>
  );
}
