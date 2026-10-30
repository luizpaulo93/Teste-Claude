import { notFound } from 'next/navigation';
import { DiagnosisForm } from '@/components/mentoria/diagnosis-form';
import { Card } from '@/components/ui';
import { getMentoria } from '@/lib/mentoria-data';

export default async function AdminMentoradoDiagnosis({ params }: { params: Promise<{ id: string }> }) {
  const m = await getMentoria(decodeURIComponent((await params).id));
  if (!m) notFound();
  return (
    <Card className="p-4 sm:p-6">
      {!m.diagnosed_at && <p className="mb-4 rounded-xl bg-warning/10 p-3 text-sm text-ink">O aluno ainda não preencheu o diagnóstico. Você pode preencher por ele.</p>}
      <DiagnosisForm mentoria={m} mentoriaId={m.id} />
    </Card>
  );
}
