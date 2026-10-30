import { Radio } from 'lucide-react';
import { LiveCard } from '@/components/live/live-card';
import { EmptyState } from '@/components/ui';
import { sql } from '@/lib/db';
import type { LiveSession } from '@/lib/types';

/** Lives só da mentoria: no ar, agendadas e gravadas (a gravação também vira aula na pasta "Lives"). */
export async function SpaceLives({ spaces, admin }: { spaces: string[]; admin?: boolean }) {
  const lives = spaces.length
    ? await sql.query<LiveSession>(`select * from live_sessions where (space = any($1) or audience && $1::text[]) ${admin ? '' : 'and is_published'} order by starts_at desc limit 100`, [spaces])
    : [];
  const now = lives.filter((l) => l.status === 'live');
  const next = lives.filter((l) => l.status === 'scheduled').reverse();
  const past = lives.filter((l) => l.status === 'ended' && l.youtube_id);
  if (!lives.length)
    return <EmptyState icon={<Radio className="size-6" />} title="Nenhuma live da mentoria" description={admin ? 'Em Admin → Ao vivo, agende uma live escolhendo esta mentoria em "Quem pode assistir".' : 'Quando o mentor agendar uma live, ela aparece aqui.'} />;
  const Section = ({ title, list }: { title: string; list: LiveSession[] }) =>
    list.length ? (
      <section className="space-y-2.5">
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((l) => (
            <LiveCard key={l.id} live={l} />
          ))}
        </div>
      </section>
    ) : null;
  return (
    <div className="space-y-6">
      <Section title="Ao vivo agora" list={now} />
      <Section title="Próximas" list={next} />
      <Section title="Gravadas" list={past} />
    </div>
  );
}
