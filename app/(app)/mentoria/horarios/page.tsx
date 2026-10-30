import type { Metadata } from 'next';
import { ScheduleForm } from '@/components/mentoria/schedule-form';
import { Card } from '@/components/ui';
import { emailKey } from '@/lib/db';
import { getMentoria } from '@/lib/mentoria-data';
import { requireViewer } from '@/lib/session';

export const metadata: Metadata = { title: 'Horários · Mentoria' };

export default async function MentoriaHours({ searchParams }: { searchParams: Promise<{ primeira?: string }> }) {
  const viewer = await requireViewer();
  const m = await getMentoria(emailKey(viewer.email));
  if (!m) return null;
  const first = (await searchParams).primeira === '1' || !m.diagnosed_at;
  return (
    <Card className="p-4 sm:p-6">
      {first && (
        <div className="mb-5 rounded-xl bg-brand/10 p-4 text-sm text-ink">
          <p className="font-bold">Bem-vindo à mentoria! 👋</p>
          <p className="mt-1 text-ink-2">Diga quanto tempo você tem em cada dia. Seu cronograma é montado nesses horários.</p>
        </div>
      )}
      <ScheduleForm availability={m.availability} next={first ? '/mentoria' : undefined} />
    </Card>
  );
}
