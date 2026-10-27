import { CheckCircle2, Heart, Play } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CoverFallback } from '@/components/course/course-card';
import { EmptyState, Img, PageHeader } from '@/components/ui';
import { getMyState, visibleLessons, type LessonSummary } from '@/lib/data';
import { requireViewer } from '@/lib/session';
import { cn, youtubeThumb } from '@/lib/utils';

export const metadata: Metadata = { title: 'Minhas aulas' };

export default async function MyLessonsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const viewer = await requireViewer();
  const { tab = 'favoritas' } = await searchParams;
  const state = await getMyState(viewer.userId);
  const lessonIds = tab === 'concluidas' ? state.progress.filter((p) => p.completed).map((p) => p.lesson_id) : state.favorites.map((f) => f.lesson_id);

  const idSet = new Set(lessonIds);
  const visible = await visibleLessons(viewer, (l) => idSet.has(l.id));
  const byId = new Map(visible.map((l) => [l.id, l]));
  const lessons = lessonIds.map((id) => byId.get(id)).filter(Boolean) as LessonSummary[];

  const tabs = [
    { key: 'favoritas', label: 'Favoritas', icon: Heart },
    { key: 'concluidas', label: 'Concluídas', icon: CheckCircle2 },
  ];

  return (
    <>
      <PageHeader title="Minhas aulas" subtitle="Suas aulas favoritas e o histórico do que você já concluiu." />
      <div className="mb-6 inline-flex rounded-xl border border-line bg-surface-2 p-1">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/minhas-aulas?tab=${t.key}`}
            scroll={false}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition',
              tab === t.key ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink',
            )}
          >
            <t.icon className="size-4" /> {t.label}
          </Link>
        ))}
      </div>
      {lessons.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {lessons.map((l) => (
            <Link key={l.id} href={`/aula/${l.id}`} className="group cv-auto">
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-line bg-surface-2">
                {l.thumbnail_url || l.youtube_id ? (
                  <Img src={l.thumbnail_url || youtubeThumb(l.youtube_id)} className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <CoverFallback title="" seed={l.id} />
                )}
                <div className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="grid size-11 place-items-center rounded-full bg-white/90 text-black">
                    <Play className="ml-0.5 size-5 fill-current" />
                  </span>
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-semibold text-ink">{l.title}</p>
              {l.duration && <p className="text-xs text-muted">{l.duration}</p>}
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={tab === 'concluidas' ? <CheckCircle2 className="size-6" /> : <Heart className="size-6" />}
          title={tab === 'concluidas' ? 'Nenhuma aula concluída ainda' : 'Nenhuma favorita ainda'}
          description={tab === 'concluidas' ? 'Conclua aulas para acompanhar seu histórico aqui.' : 'Toque no coração dentro de uma aula para salvá-la aqui.'}
        />
      )}
    </>
  );
}
