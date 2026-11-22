import { BookOpen, ClipboardCheck, MessageCircleQuestion, PlayCircle, UserCheck, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, PageHeader, Stat } from '@/components/ui';
import { RecentPeople, type RecentPerson } from './recent-people';
import { getCatalogData, sql } from '@/lib/db';

export const metadata: Metadata = { title: 'Painel admin' };

export default async function AdminHome() {
  const [counts, catalog, recentList] = await Promise.all([
    sql.one<{ students: number; active: number; open_doubts: number; sims: number; users: number }>(
      `select (select count(*) from students)::int as students,
              (select count(*) from students where status = 'active')::int as active,
              (select count(*) from doubts where not is_resolved)::int as open_doubts,
              (select count(*) from simulados where is_published)::int as sims,
              (select count(*) from users)::int as users`,
    ),
    getCatalogData(),
    sql.query<RecentPerson>(
      `select u.id, u.email, u.full_name, u.avatar_url, u.role, u.created_at, s.status, c.name as class_name,
              coalesce(case when s.questoes is null then s.status = 'active' and s.class_id is not null else s.questoes end, false) as questoes,
              exists(select 1 from mentorias m where m.id = replace(lower(u.email), '/', '_') and m.status = 'active') as mentoria
         from users u
         left join students s on s.email = lower(u.email)
         left join classes c on c.id = s.class_id
         order by u.created_at desc limit 8`,
    ),
  ]);
  const { students = 0, active = 0, open_doubts: openDoubts = 0, sims = 0, users = 0 } = counts ?? {};
  const classes = [...catalog.classes].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <PageHeader title="Visão geral" />
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
        <Stat
          label="Cursos / aulas"
          value={`${catalog.courses.length} / ${new Set(catalog.lessons.map((l) => l.id)).size}`}
          icon={<BookOpen className="size-4" />}
        />
        <Stat label="Turmas" value={catalog.classes.length} hint="Grupos de acesso" icon={<PlayCircle className="size-4" />} />
        <Stat
          label="Dúvidas abertas"
          value={openDoubts}
          hint={
            <Link href="/duvidas?f=abertas" className="text-brand">
              Responder
            </Link>
          }
          icon={<MessageCircleQuestion className="size-4" />}
        />
        <Stat label="Simulados publicados" value={sims} icon={<ClipboardCheck className="size-4" />} />
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line p-4 sm:p-5">
          <div>
            <p className="text-sm font-bold text-ink">Últimos cadastros</p>
            <p className="text-xs text-muted">Toque na pessoa para liberar turma, mentoria ou questões.</p>
          </div>
          <Link href="/admin/alunos" className="text-xs font-semibold text-brand">
            Gerenciar alunos
          </Link>
        </div>
        <RecentPeople people={recentList} classes={classes} />
      </Card>
    </>
  );
}
