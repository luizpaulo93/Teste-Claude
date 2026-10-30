import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { daysUntil } from '@/lib/mentoria';
import { getMentoria, unreadCount } from '@/lib/mentoria-data';
import { MentoriaTabs } from '../../../mentoria/tabs';

export default async function AdminMentoradoLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mid = decodeURIComponent(id);
  if (!mid || mid.includes('/') || mid.length > 200) notFound();
  const m = await getMentoria(mid);
  if (!m) notFound();
  const unread = await unreadCount(m.id, true);
  const left = daysUntil(m.exam_date);
  const base = `/admin/mentoria/${encodeURIComponent(m.id)}`;
  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/mentoria" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
          <ChevronLeft className="size-4" /> Mentoria
        </Link>
        <PageHeader
          title={m.student_name || m.student_email}
          subtitle={[m.exam_target, left !== null && left >= 0 ? `${left} dias para a prova` : ''].filter(Boolean).join(' · ') || m.student_email}
        />
      </div>
      <MentoriaTabs
        base={base}
        tabs={[
          { href: '', label: 'Cronograma' },
          { href: '/assuntos', label: 'Assuntos' },
          { href: '/mensagens', label: 'Mensagens', badge: unread },
          { href: '/horarios', label: 'Horários' },
        ]}
      />
      {children}
    </div>
  );
}
