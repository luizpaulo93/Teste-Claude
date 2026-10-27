import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import type { Course, LiveSession } from '@/lib/types';
import { LivesManager } from './lives-manager';

export const metadata: Metadata = { title: 'Ao vivo · Admin' };

export default async function AdminLives() {
  const supabase = await createClient();
  const [{ data: lives }, { data: courses }] = await Promise.all([
    supabase.from('live_sessions').select('*').order('starts_at', { ascending: false }).limit(200),
    supabase.from('courses').select('id,title').order('position'),
  ]);
  return (
    <>
      <PageHeader title="Ao vivo" subtitle="Transmita pelo YouTube como não listado — só alunos com acesso ao curso assistem aqui dentro." />
      <LivesManager lives={(lives ?? []) as LiveSession[]} courses={(courses ?? []) as Pick<Course, 'id' | 'title'>[]} />
    </>
  );
}
