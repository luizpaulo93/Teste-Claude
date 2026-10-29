import { Lock, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import { Img, ProgressBar } from '@/components/ui';
import type { Course } from '@/lib/types';
import { cn } from '@/lib/utils';

const GRADIENTS = [
  'from-[#0a1530] via-[#172554] to-[#2563eb]',
  'from-[#050b18] via-[#0f244c] to-[#1d4ed8]',
  'from-[#030712] via-[#0c1f44] to-[#0891b2]',
  'from-[#081226] via-[#1e1b4b] to-[#4f46e5]',
  'from-[#060d20] via-[#134e4a] to-[#0d9488]',
];

export function CoverFallback({ title, seed, className }: { title: string; seed: string; className?: string }) {
  const g = GRADIENTS[[...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % GRADIENTS.length];
  return (
    <div className={cn('absolute inset-0 bg-gradient-to-br', g, className)}>
      <div className="absolute inset-0 bg-[image:radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_55%)]" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="line-clamp-3 text-lg leading-tight font-extrabold text-white drop-shadow">{title}</p>
      </div>
    </div>
  );
}

export function CourseCard({
  course,
  locked,
  progress,
  lessons,
  priority,
}: {
  course: Course;
  locked: boolean;
  progress: number;
  lessons: number;
  priority?: boolean;
}) {
  return (
    <Link href={`/cursos/${course.id}`} className="group block w-full outline-none" prefetch={priority ? true : undefined}>
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-card transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-glow group-focus-visible:shadow-glow">
        {course.cover_url ? (
          <Img
            src={course.cover_url}
            loading={priority ? 'eager' : 'lazy'}
            className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <CoverFallback title="" seed={course.id} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          {course.is_free && <span className="rounded-full bg-success px-2 py-0.5 text-[10px] font-bold text-white">GRÁTIS</span>}
        </div>
        {locked ? (
          <div className="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur">
            <Lock className="size-4" />
          </div>
        ) : (
          <div className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <PlayCircle className="size-14 text-white drop-shadow-lg" strokeWidth={1.5} />
          </div>
        )}
        {/* Nome completo na capa */}
        <div className="absolute inset-x-0 bottom-0 space-y-2 p-3 sm:p-3.5">
          <p className="text-[13px] leading-tight font-extrabold tracking-wide text-balance text-white uppercase drop-shadow">{course.title}</p>
          {!locked && progress > 0 && <ProgressBar value={progress} className="h-1 bg-white/20" />}
        </div>
      </div>
      <p className="mt-2 px-0.5 text-xs text-muted">
        {locked ? 'Exclusivo para alunos' : `${lessons} aula${lessons === 1 ? '' : 's'}${progress ? ` · ${progress}%` : ''}`}
      </p>
    </Link>
  );
}
