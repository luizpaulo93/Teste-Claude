import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { PageHeader } from '@/components/ui';
import { getCatalogData, sql } from '@/lib/db';
import type { LiveSession } from '@/lib/types';
import { getAccount, oauthConfigured } from '@/lib/youtube';
import { LivesManager } from './lives-manager';
import { liveAudienceOptions } from './options';

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
  const [lives, catalog, acc, { options, spaces }] = await Promise.all([
    sql.query<LiveSession>(`select * from live_sessions order by starts_at desc limit 200`),
    getCatalogData(),
    getAccount(),
    liveAudienceOptions(),
  ]);
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
