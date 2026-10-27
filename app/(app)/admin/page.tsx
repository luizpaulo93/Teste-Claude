import { BookOpen, ClipboardCheck, MessageCircleQuestion, PlayCircle, UserCheck, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Avatar, Badge, Card, PageHeader, Stat } from '@/components/ui';
import { db, emailKey, fromQuery, getCatalogData, getMany } from '@/lib/db';
import { timeAgo } from '@/lib/utils';

export const metadata: Metadata = { title: 'Painel admin' };

export default async function AdminHome() {
  const d = db();
  const count = async (q: FirebaseFirestore.Query) => (await q.count().get()).data().count;
  const [students, active, catalog, openDoubts, sims, users, recentSnap] = await Promise.all([
    count(d.collection('students')),
    count(d.collection('students').where('status', '==', 'active')),
    getCatalogData(),
    count(d.collection('doubts').where('is_resolved', '==', false)),
    count(d.collection('simulados').where('is_published', '==', true)),
    count(d.collection('users')),
    d.collection('users').orderBy('created_at', 'desc').limit(8).get(),
  ]);
  const recentList = fromQuery<{ id: string; email: string; full_name: string; avatar_url: string; role: string; created_at: string }>(recentSnap);
  const listed = await getMany<{ id: string; email: string; status: string }>('students', recentList.map((u) => emailKey(u.email)));
  const listedMap = new Map(listed.map((s) => [s.email.toLowerCase(), s.status]));

  return (
    <>
      <PageHeader title="Visão geral" subtitle="Números da plataforma em tempo real." />
      {catalog.courses.length === 0 && (
        <Card className="mb-6 flex flex-col gap-3 border-brand/30 bg-brand-soft p-5 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="font-bold text-ink">Plataforma vazia</p>
            <p className="text-sm text-muted">Quer testar com conteúdo pronto? Carregue cursos, aulas, simulado e live de exemplo com um clique.</p>
          </div>
          <Link href="/admin/config" className="text-sm font-semibold text-brand">
            Carregar exemplos →
          </Link>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Alunos na lista" value={students} hint={`${active} ativos`} icon={<Users className="size-4" />} />
        <Stat label="Contas criadas" value={users} hint="Pessoas que já entraram" icon={<UserCheck className="size-4" />} />
        <Stat label="Cursos / aulas" value={`${catalog.courses.length} / ${catalog.lessons.length}`} icon={<BookOpen className="size-4" />} />
        <Stat label="Turmas" value={catalog.classes.length} hint="Grupos de acesso" icon={<PlayCircle className="size-4" />} />
        <Stat label="Dúvidas abertas" value={openDoubts} hint={<Link href="/duvidas?f=abertas" className="text-brand">Responder</Link>} icon={<MessageCircleQuestion className="size-4" />} />
        <Stat label="Simulados publicados" value={sims} icon={<ClipboardCheck className="size-4" />} />
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
