import { CalendarClock, Target } from 'lucide-react';
import { Badge, EmptyState, LinkButton } from '@/components/ui';
import { emailKey } from '@/lib/db';
import { daysUntil } from '@/lib/mentoria';
import { getMentoria } from '@/lib/mentoria-data';
import { ensureGroupMember } from '@/lib/mentoria-space';
import { requireViewer } from '@/lib/session';
import { MentoriaTabs } from './tabs';

export default async function MentoriaLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  // Entrou num grupo (ex.: pela turma) e ainda não tem cronograma: cria agora
  await ensureGroupMember(viewer);
  const m = await getMentoria(emailKey(viewer.email));
  if (!m) {
    return (
      <EmptyState
        icon={<Target className="size-6" />}
        title="Você ainda não participa da mentoria"
        description="Na mentoria, seu cronograma é montado por assunto, com revisões até você dominar cada um."
        action={viewer.isAdmin ? <LinkButton href="/admin/mentoria">Gerenciar mentorias</LinkButton> : undefined}
      />
    );
  }
  const left = daysUntil(m.exam_date);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[0.2em] text-brand uppercase">Mentoria</p>
          <h1 className="truncate text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{m.exam_target || 'Seu cronograma'}</h1>
        </div>
        <div className="flex items-center gap-2">
          {left !== null && left >= 0 && (
            <span className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink">
              <CalendarClock className="size-3.5 text-brand" /> {left === 0 ? 'A prova é hoje!' : `${left} dias para a prova`}
            </span>
          )}
          {viewer.isAdmin && (
            <LinkButton href={`/admin/mentoria/${encodeURIComponent(m.id)}`} variant="secondary" size="sm">
              Área do mentor
            </LinkButton>
          )}
          {m.status !== 'active' && <Badge tone="warning">{m.status === 'paused' ? 'Pausada' : 'Encerrada'}</Badge>}
        </div>
      </div>
      <MentoriaTabs
        base="/mentoria"
        tabs={[
          { href: '', label: 'Cronograma' },
          { href: '/assuntos', label: 'Assuntos' },
          { href: '/duvidas', label: 'Dúvidas' },
          { href: '/lives', label: 'Lives' },
          { href: '/horarios', label: 'Horários' },
        ]}
      />
      {children}
    </div>
  );
}
