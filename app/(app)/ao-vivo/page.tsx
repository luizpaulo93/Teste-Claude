import { Radio } from 'lucide-react';
import type { Metadata } from 'next';
import { LiveCard } from '@/components/live/live-card';
import { EmptyState, PageHeader } from '@/components/ui';
import { requireViewer } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { LiveSession } from '@/lib/types';

export const metadata: Metadata = { title: 'Ao vivo' };

export default async function LivesPage() {
  const viewer = await requireViewer();
  if (!viewer.isMember) {
    return (
      <>
        <PageHeader title="Ao vivo" />
        <EmptyState icon={<Radio className="size-6" />} title="Exclusivo para alunos" description="As aulas ao vivo ficam disponíveis para alunos com a turma liberada." />
      </>
    );
  }
  const supabase = await createClient();
  const { data } = await supabase.from('live_sessions').select('*').eq('is_published', true).order('starts_at', { ascending: false }).limit(200);
  const all = (data ?? []) as LiveSession[];
  const now = all.filter((l) => l.status === 'live');
  const next = all.filter((l) => l.status === 'scheduled').reverse();
  const past = all.filter((l) => l.status === 'ended' && l.show_replay && l.youtube_id);

  const grid = (list: LiveSession[]) => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {list.map((l) => (
        <LiveCard key={l.id} live={l} />
      ))}
    </div>
  );

  return (
    <>
      <PageHeader eyebrow="Transmissões" title="Ao vivo" subtitle="Aulões, plantões e revisões em tempo real com o professor." />
      {!all.length && <EmptyState icon={<Radio className="size-6" />} title="Nenhuma transmissão agendada" description="Quando uma aula ao vivo for marcada ela aparece aqui." />}
      <div className="space-y-10">
        {now.length > 0 && (
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold text-ink">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
              </span>
              Acontecendo agora
            </h2>
            {grid(now)}
          </section>
        )}
        {next.length > 0 && (
          <section>
            <h2 className="mb-4 text-lg font-extrabold text-ink">Próximas transmissões</h2>
            {grid(next)}
          </section>
        )}
        {past.length > 0 && (
          <section>
            <h2 className="mb-4 text-lg font-extrabold text-ink">Gravações</h2>
            {grid(past)}
          </section>
        )}
      </div>
    </>
  );
}
