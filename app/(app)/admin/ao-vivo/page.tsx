import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { PageHeader } from '@/components/ui';
import { getCatalogData, sql } from '@/lib/db';
import type { LiveSession } from '@/lib/types';
import { getAccount, oauthConfigured } from '@/lib/youtube';
import { LivesManager } from './lives-manager';

export const metadata: Metadata = { title: 'Ao vivo · Admin' };

const NOTICES: Record<string, string> = {
  ok: 'Conta do YouTube conectada.',
  erro: 'Não foi possível conectar ao YouTube. Tente de novo.',
  'sem-config': 'Falta configurar GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET na Vercel. Siga o passo a passo abaixo.',
};

export default async function AdminLives({ searchParams }: { searchParams: Promise<{ yt?: string }> }) {
  const { yt: notice } = await searchParams;
  const [lives, catalog, acc, groups, singles, classes, students] = await Promise.all([
    sql.query<LiveSession>(`select * from live_sessions order by starts_at desc limit 200`),
    getCatalogData(),
    getAccount(),
    sql.query<{ id: string; name: string }>(`select id, name from mentoria_groups order by name`),
    sql.query<{ id: string; name: string }>(`select id, coalesce(nullif(student_name, ''), student_email) as name from mentorias where group_id is null order by 2`),
    sql.query<{ id: string; name: string }>(`select id, name from classes order by name`),
    sql.query<{ id: string; name: string }>(`select id, coalesce(nullif(name, ''), email) as name from students order by 2 limit 5000`),
  ]);
  const spaces = [...groups.map((g) => ({ key: `g:${g.id}`, label: `${g.name} (grupo)` })), ...singles.map((m) => ({ key: `m:${m.id}`, label: m.name }))];
  const options = {
    classes: classes.map((c) => ({ key: `c:${c.id}`, label: c.name })),
    mentorias: spaces,
    students: students.map((x) => ({ key: `u:${x.id}`, label: x.name, sub: x.id })),
    courses: catalog.courses.map((c) => ({ key: `course:${c.id}`, label: c.title })),
  };
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
  const yt = { oauth: oauthConfigured(), channel: acc.refresh_token ? acc.channel_title || 'Seu canal' : '', notice: notice ? NOTICES[notice] : undefined, origin };
  const courses = catalog.courses.map((c) => ({ id: c.id, title: c.title }));
  return (
    <>
      <PageHeader title="Ao vivo" subtitle="Transmita do Estúdio direto para o seu canal (não listado). Só alunos com acesso assistem aqui dentro." />
      <LivesManager lives={lives} courses={courses} yt={yt} spaces={spaces} options={options} />
    </>
  );
}
