import { ChevronLeft, Eye } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ReportDownload } from '@/components/mentoria/report-download';
import { LinkButton, PageHeader } from '@/components/ui';
import { emailKey } from '@/lib/db';
import { getViewer } from '@/lib/session';
import { daysUntil } from '@/lib/mentoria';
import { countCycles } from '@/lib/mentoria-cycles';
import { getMentoria } from '@/lib/mentoria-data';
import { pendingDoubts } from '@/lib/mentoria-space';
import { MentoriaTabs } from '../../../mentoria/tabs';

export default async function AdminMentoradoLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mid = decodeURIComponent(id);
  if (!mid || mid.includes('/') || mid.length > 200) notFound();
  const m = await getMentoria(mid);
  if (!m) notFound();
  const pending = (await pendingDoubts()).get(`m:${m.id}`) ?? 0;
  const left = daysUntil(m.exam_date);
  const previous = await countCycles(m.id);
  // A própria mentoria do mentor: dá para abrir a página como o aluno vê
  const viewer = await getViewer();
  const own = Boolean(viewer && emailKey(viewer.email) === m.id);
  const base = `/admin/mentoria/${encodeURIComponent(m.id)}`;
  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/mentoria" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
          <ChevronLeft className="size-4" /> Mentoria
        </Link>
        <PageHeader
          title={m.student_name || m.student_email}
          actions={
            <>
              {own && (
                <LinkButton href="/mentoria" variant="secondary" size="sm">
                  <Eye className="size-4" /> Ver como aluno
                </LinkButton>
              )}
              <ReportDownload target={`m:${m.id}`} />
            </>
          }
          subtitle={[m.scope === 'especifica' ? 'Mentoria específica' : 'Mentoria completa', m.exam_target, left !== null && left >= 0 ? `${left} dias para a prova` : ''].filter(Boolean).join(' · ') || m.student_email}
        />
      </div>
      <MentoriaTabs
        base={base}
        tabs={[
          { href: '', label: 'Cronograma' },
          { href: '/assuntos', label: 'Assuntos' },
          { href: '/apostilas', label: 'Apostilas' },
          { href: '/duvidas', label: 'Dúvidas', badge: pending },
          { href: '/horarios', label: 'Horários' },
          ...(previous ? [{ href: '/anteriores', label: `Anteriores (${previous})` }] : []),
        ]}
      />
      {children}
    </div>
  );
}
