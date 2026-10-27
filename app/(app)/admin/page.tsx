import { BookOpen, ClipboardCheck, MessageCircleQuestion, PlayCircle, UserCheck, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Avatar, Badge, Card, PageHeader, Stat } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import { timeAgo } from '@/lib/utils';

export const metadata: Metadata = { title: 'Painel admin' };

export default async function AdminHome() {
  const supabase = await createClient();
  const head = { count: 'exact' as const, head: true };
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const [students, active, courses, lessons, openDoubts, sims, users, recentProgress, recent] = await Promise.all([
    supabase.from('students').select('id', head),
    supabase.from('students').select('id', head).eq('status', 'active'),
    supabase.from('courses').select('id', head),
    supabase.from('lessons').select('id', head),
    supabase.from('doubts').select('id', head).eq('is_resolved', false),
    supabase.from('simulados').select('id', head).eq('is_published', true),
    supabase.from('profiles').select('id', head),
    supabase.from('lesson_progress').select('user_id', head).gte('updated_at', since),
    supabase.from('profiles').select('id,email,full_name,avatar_url,role,created_at').order('created_at', { ascending: false }).limit(8),
  ]);
  const recentList = (recent.data ?? []) as { id: string; email: string; full_name: string; avatar_url: string; role: string; created_at: string }[];
  const { data: listed } = recentList.length
    ? await supabase.from('students').select('email,status').in('email', recentList.map((r) => r.email))
    : { data: [] };
  const listedMap = new Map((listed ?? []).map((s: { email: string; status: string }) => [s.email.toLowerCase(), s.status]));

  return (
    <>
      <PageHeader title="Visão geral" subtitle="Números da plataforma em tempo real." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Alunos na lista" value={students.count ?? 0} hint={`${active.count ?? 0} ativos`} icon={<Users className="size-4" />} />
        <Stat label="Contas criadas" value={users.count ?? 0} hint="Pessoas que já entraram" icon={<UserCheck className="size-4" />} />
        <Stat label="Cursos / aulas" value={`${courses.count ?? 0} / ${lessons.count ?? 0}`} icon={<BookOpen className="size-4" />} />
        <Stat label="Atividade (7 dias)" value={recentProgress.count ?? 0} hint="Aulas assistidas" icon={<PlayCircle className="size-4" />} />
        <Stat label="Dúvidas abertas" value={openDoubts.count ?? 0} hint={<Link href="/duvidas?f=abertas" className="text-brand">Responder</Link>} icon={<MessageCircleQuestion className="size-4" />} />
        <Stat label="Simulados publicados" value={sims.count ?? 0} icon={<ClipboardCheck className="size-4" />} />
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line p-4 sm:p-5">
          <p className="text-sm font-bold text-ink">Últimos cadastros</p>
          <Link href="/admin/alunos" className="text-xs font-semibold text-brand">
            Gerenciar alunos
          </Link>
        </div>
        <ul className="divide-y divide-line">
          {recentList.map((u) => {
            const st = listedMap.get(u.email.toLowerCase());
            return (
              <li key={u.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <Avatar name={u.full_name || u.email} src={u.avatar_url} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{u.full_name || '—'}</p>
                  <p className="truncate text-xs text-muted">{u.email}</p>
                </div>
                {u.role === 'admin' ? <Badge tone="brand">Admin</Badge> : st === 'active' ? <Badge tone="success">Liberado</Badge> : st === 'blocked' ? <Badge tone="danger">Bloqueado</Badge> : <Badge tone="warning">Fora da lista</Badge>}
                <span className="hidden text-xs text-muted sm:block">{timeAgo(u.created_at)}</span>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
