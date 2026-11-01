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

const REASONS: Record<string, string> = {
  cliente: 'O Google recusou o ID ou a chave secreta. Confira GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET na Vercel (sem espaços) e faça Redeploy.',
  redirect: 'O endereço de retorno não confere. No Google Cloud → Clientes, o URI de redirecionamento deve ser exatamente o deste site + /api/youtube/callback.',
  expirou: 'A autorização expirou ou já foi usada. Toque em Conectar de novo.',
  api: 'A YouTube Data API v3 não está ativada no projeto do Google Cloud desse cliente. Ative em APIs e serviços → Biblioteca e tente de novo após 2 minutos.',
  canal: 'Essa conta Google não tem canal no YouTube. Conecte com a conta (ou conta de marca) dona do canal.',
  permissao: 'A permissão para gerenciar o YouTube não foi concedida. Conecte de novo e marque a permissão do YouTube.',
  negado: 'Você cancelou a autorização no Google.',
  sessao: 'A sessão da conexão expirou. Toque em Conectar de novo (use sempre o mesmo endereço do site).',
};

export default async function AdminLives({ searchParams }: { searchParams: Promise<{ yt?: string; m?: string }> }) {
  const { yt: notice, m } = await searchParams;
  const [lives, catalog, acc, groups, singles, classes, students] = await Promise.all([
    sql.query<LiveSession>(`select * from live_sessions order by starts_at desc limit 200`),
    getCatalogData(),
    getAccount(),
    sql.query<{ id: string; name: string }>(`select id, name from mentoria_groups order by name`),
    sql.query<{ id: string; name: string; email: string }>(`select id, coalesce(nullif(student_name, ''), student_email) as name, student_email as email from mentorias where group_id is null order by 2`),
    sql.query<{ id: string; name: string; course_ids: string[]; access_all: boolean }>(`select id, name, course_ids, access_all from classes order by name`),
    sql.query<{ id: string; name: string }>(`select id, coalesce(nullif(name, ''), email) as name from students order by 2 limit 5000`),
  ]);
  const spaces = [...groups.map((g) => ({ key: `g:${g.id}`, label: `${g.name} (grupo)` })), ...singles.map((m) => ({
      key: `m:${m.id}`,
      // nomes iguais: mostra o e-mail para diferenciar
      label: singles.filter((x) => x.name === m.name).length > 1 ? `${m.name} (${m.email})` : m.name,
    })),
  ];
  const options = {
    classes: classes.map((c) => ({ key: `c:${c.id}`, label: c.name, courseIds: c.course_ids ?? [], all: c.access_all })),
    mentorias: spaces,
    students: students.map((x) => ({ key: `u:${x.id}`, label: x.name, sub: x.id })),
    courses: catalog.courses.map((c) => ({ key: `course:${c.id}`, label: c.title })),
  };
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
  const yt = { oauth: oauthConfigured(), channel: acc.refresh_token ? acc.channel_title || 'Seu canal' : '', notice: notice ? (notice === 'erro' && m ? `Não foi possível conectar: ${REASONS[m] ?? m}` : NOTICES[notice]) : undefined, origin };
  const courses = catalog.courses.map((c) => ({ id: c.id, title: c.title }));
  return (
    <>
      <PageHeader title="Ao vivo" subtitle="Transmita do Estúdio direto para o seu canal (não listado). Só alunos com acesso assistem aqui dentro." />
      <LivesManager lives={lives} courses={courses} yt={yt} spaces={spaces} options={options} />
    </>
  );
}
