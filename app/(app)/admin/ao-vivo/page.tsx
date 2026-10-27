import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { db, fromQuery, getCatalogData } from '@/lib/db';
import type { LiveSession } from '@/lib/types';
import { LivesManager } from './lives-manager';

export const metadata: Metadata = { title: 'Ao vivo · Admin' };

export default async function AdminLives() {
  const [snap, catalog] = await Promise.all([db().collection('live_sessions').orderBy('starts_at', 'desc').limit(200).get(), getCatalogData()]);
  const lives = fromQuery<LiveSession>(snap);
  const courses = catalog.courses.map((c) => ({ id: c.id, title: c.title }));
  return (
    <>
      <PageHeader title="Ao vivo" subtitle="Transmita pelo YouTube como não listado — só alunos com acesso ao curso assistem aqui dentro." />
      <LivesManager lives={lives} courses={courses} />
    </>
  );
}
