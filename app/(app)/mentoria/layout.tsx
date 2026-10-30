import { CalendarClock, Target } from 'lucide-react';
import { Badge, EmptyState, LinkButton } from '@/components/ui';
import { emailKey, sql } from '@/lib/db';
import { daysUntil, todayBR } from '@/lib/mentoria';
import { getMentoria, unreadCount } from '@/lib/mentoria-data';
import { requireViewer } from '@/lib/session';
import { MentoriaTabs } from './tabs';

export default async function MentoriaLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const m = await getMentoria(emailKey(viewer.email));
  if (!m) {
    return (
      <EmptyState
        icon={<Target className="size-6" />}
        title="Você ainda não participa da mentoria"
        description="A mentoria inclui diagnóstico, cronograma personalizado, cronômetro, caderno de erros, desempenho e conversa com o mentor."
        action={viewer.isAdmin ? <LinkButton href="/admin/mentoria">Gerenciar mentorias</LinkButton> : undefined}
      />
    );
  }
  const [unread, due] = await Promise.all([
    unreadCount(m.id, false),
    sql.one<{ n: number }>(`select count(*)::int as n from mentoria_errors where mentoria_id = $1 and not mastered and next_review <= $2`, [m.id, todayBR()]),
  ]);
  const left = daysUntil(m.exam_date);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[0.2em] text-brand uppercase">Mentoria</p>
          <h1 className="truncate text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{m.target_course || m.exam_target || 'Seu plano de estudos'}</h1>
        </div>
        <div className="flex items-center gap-2">
          {left !== null && left >= 0 && (
            <span className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink">
              <CalendarClock className="size-3.5 text-brand" /> {left === 0 ? 'A prova é hoje!' : `${left} dias para a prova`}
            </span>
          )}
          {m.status !== 'active' && <Badge tone="warning">{m.status === 'paused' ? 'Pausada' : 'Encerrada'}</Badge>}
        </div>
      </div>
      <MentoriaTabs
        base="/mentoria"
        tabs={[
          { href: '', label: 'Hoje' },
          { href: '/plano', label: 'Plano' },
          { href: '/conteudos', label: 'Conteúdos' },
          { href: '/desempenho', label: 'Desempenho' },
          { href: '/erros', label: 'Caderno de erros', badge: due?.n ?? 0 },
          { href: '/mensagens', label: 'Mentor', badge: unread },
          { href: '/diagnostico', label: 'Diagnóstico' },
        ]}
      />
      {children}
    </div>
  );
}
