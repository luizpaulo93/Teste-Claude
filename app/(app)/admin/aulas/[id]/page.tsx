import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import type { LessonMaterial, LiveMessage } from '@/lib/types';
import { isDocId } from '@/lib/utils';
import { LiveLessonEditor } from './live-lesson';

export const metadata: Metadata = { title: 'Aula da live · Admin' };

/** Aula que veio de uma live: vídeo, o que foi dito no chat e os PDFs. Nome e PDFs editáveis; o link não. */
export default async function LiveLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isDocId(id)) notFound();
  const lesson = await sql.one<{ id: string; title: string; youtube_id: string; materials: LessonMaterial[]; folder_id: string | null }>(
    `select id, title, youtube_id, materials, folder_id from lessons where id = $1`,
    [id],
  );
  if (!lesson) notFound();
  const live = await sql.one<{ id: string; title: string; starts_at: string }>(
    `select id, title, starts_at from live_sessions
      where lesson_id = $1
         or (youtube_id <> '' and youtube_id = $2 and exists (select 1 from lesson_folders f where f.id = $3 and lower(f.name) in ('live', 'lives')))
      order by (lesson_id = $1) desc nulls last limit 1`,
    [id, lesson.youtube_id, lesson.folder_id],
  );
  const messages = live ? await sql.query<LiveMessage>(`select * from live_messages where live_id = $1 order by created_at limit 2000`, [live.id]) : [];
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link
        href={`/admin/aulas${lesson.folder_id ? `?f=${lesson.folder_id}` : ''}`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"
      >
        <ChevronLeft className="size-4" /> Banco de aulas
      </Link>
      <LiveLessonEditor lesson={lesson} startsAt={live?.starts_at ?? null} messages={messages} />
    </div>
  );
}
