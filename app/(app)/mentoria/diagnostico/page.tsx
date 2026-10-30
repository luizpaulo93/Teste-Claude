import type { Metadata } from 'next';
import { DiagnosisForm } from '@/components/mentoria/diagnosis-form';
import { Card } from '@/components/ui';
import { emailKey } from '@/lib/db';
import { getMentoria } from '@/lib/mentoria-data';
import { requireViewer } from '@/lib/session';

export const metadata: Metadata = { title: 'Diagnóstico · Mentoria' };

export default async function MentoriaDiagnosis({ searchParams }: { searchParams: Promise<{ primeira?: string }> }) {
  const viewer = await requireViewer();
  const m = await getMentoria(emailKey(viewer.email));
  if (!m) return null;
  const first = (await searchParams).primeira === '1' || !m.diagnosed_at;
  return (
    <Card className="p-4 sm:p-6">
      {first && (
        <div className="mb-5 rounded-xl bg-brand/10 p-4 text-sm text-ink">
          <p className="font-bold">Bem-vindo à mentoria! 👋</p>
          <p className="mt-1 text-ink-2">Responda em 2 minutos: com isso montamos seu cronograma da semana automaticamente.</p>
        </div>
      )}
      <DiagnosisForm mentoria={m} next={first ? '/mentoria/plano' : undefined} />
    </Card>
  );
}
