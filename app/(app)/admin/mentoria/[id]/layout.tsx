import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { sql } from '@/lib/db';
import { daysUntil, todayBR } from '@/lib/mentoria';
import { getMentoria, unreadCount } from '@/lib/mentoria-data';
import { MentoriaTabs } from '../../../mentoria/tabs';

export default async function AdminMentoradoLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mid = decodeURIComponent(id);
  if (!mid || mid.includes('/') || mid.length > 200) notFound();
  const m = await getMentoria(mid);
  if (!m) notFound();
  const [unread, due] = await Promise.all([
    unreadCount(m.id, true),
    sql.one<{ n: number }>(`select count(*)::int as n from mentoria_errors where mentoria_id = $1 and not mastered and next_review <= $2`, [m.id, todayBR()]),
  ]);
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
          subtitle={[m.target_course || m.exam_target, m.target_score ? `meta ${m.target_score}` : '', left !== null && left >= 0 ? `${left} dias para a prova` : ''].filter(Boolean).join(' · ') || m.student_email}
        />
      </div>
      <MentoriaTabs
        base={base}
        tabs={[
          { href: '', label: 'Plano e check-ins' },
          { href: '/conteudos', label: 'Conteúdos' },
          { href: '/desempenho', label: 'Desempenho' },
          { href: '/erros', label: 'Caderno de erros', badge: due?.n ?? 0 },
          { href: '/mensagens', label: 'Mensagens', badge: unread },
          { href: '/diagnostico', label: 'Diagnóstico' },
        ]}
      />
      {children}
    </div>
  );
}
