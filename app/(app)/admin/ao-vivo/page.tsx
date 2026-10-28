import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { getCatalogData, sql } from '@/lib/db';
import type { LiveSession } from '@/lib/types';
import { LivesManager } from './lives-manager';

export const metadata: Metadata = { title: 'Ao vivo · Admin' };

export default async function AdminLives() {
  const [lives, catalog] = await Promise.all([sql.query<LiveSession>(`select * from live_sessions order by starts_at desc limit 200`), getCatalogData()]);
  const courses = catalog.courses.map((c) => ({ id: c.id, title: c.title }));
  return (
    <>
      <PageHeader title="Ao vivo" subtitle="Transmita pelo YouTube como não listado — só alunos com acesso ao curso assistem aqui dentro." />
      <LivesManager lives={lives} courses={courses} />
    </>
  );
}
