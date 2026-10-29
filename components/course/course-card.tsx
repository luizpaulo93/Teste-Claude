import { Lock, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import { Img, ProgressBar } from '@/components/ui';
import type { Course } from '@/lib/types';
import { cn } from '@/lib/utils';

/** 10 cores padrão das capas (mesmo formato: degradê escuro → cor). */
export const GRADIENTS = [
  'from-[#0a1530] via-[#172554] to-[#2563eb]',
  'from-[#050b18] via-[#0f244c] to-[#1d4ed8]',
  'from-[#030712] via-[#0c1f44] to-[#0891b2]',
  'from-[#081226] via-[#1e1b4b] to-[#4f46e5]',
  'from-[#060d20] via-[#134e4a] to-[#0d9488]',
  'from-[#0b0a1f] via-[#3b0764] to-[#9333ea]',
  'from-[#14070d] via-[#4c0519] to-[#e11d48]',
  'from-[#140b03] via-[#451a03] to-[#d97706]',
  'from-[#04140c] via-[#064e3b] to-[#16a34a]',
  'from-[#0b0f17] via-[#1f2937] to-[#64748b]',
];

/** Capa escolhida como cor: "color:3" → 3 */
export function coverColor(url?: string | null) {
  const m = /^color:(\d)$/.exec(url ?? '');
  return m ? Number(m[1]) : null;
}
/** URL de imagem de verdade (ignora capas de cor) */
export const coverImage = (url?: string | null) => (url && coverColor(url) === null ? url : '');

export function CoverFallback({ title, seed, className, color }: { title: string; seed: string; className?: string; color?: number | null }) {
  const g = GRADIENTS[color ?? [...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % 5];
  return (
    <div className={cn('absolute inset-0 bg-gradient-to-br', g, className)}>
      <div className="absolute inset-0 bg-[image:radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_55%)]" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="line-clamp-3 text-lg leading-tight font-extrabold text-white drop-shadow">{title}</p>
      </div>
    </div>
  );
}

/** Capa 2:3 com o nome completo (curso, módulo/playlist). */
export function CoverCard({
  href,
  title,
  cover,
  seed,
  locked,
  progress = 0,
  caption,
  free,
  priority,
}: {
  href: string;
  title: string;
  cover?: string;
  seed: string;
  locked?: boolean;
  progress?: number;
  caption?: string;
  free?: boolean;
  priority?: boolean;
}) {
  return (
    <Link href={href} className="group block w-full min-w-0 outline-none" prefetch={priority ? true : undefined}>
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-card transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-glow group-focus-visible:shadow-glow">
        {coverImage(cover) ? (
          <Img src={coverImage(cover)} loading={priority ? 'eager' : 'lazy'} className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        ) : (
          <CoverFallback title="" seed={seed} color={coverColor(cover)} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
        {free && (
          <div className="absolute top-2.5 left-2.5">
            <span className="rounded-full bg-success px-2 py-0.5 text-[10px] font-bold text-white">GRÁTIS</span>
          </div>
        )}
        {locked ? (
          <div className="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur">
            <Lock className="size-4" />
          </div>
        ) : (
          <div className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <PlayCircle className="size-14 text-white drop-shadow-lg" strokeWidth={1.5} />
          </div>
        )}
        {/* Nome completo na capa, sempre do mesmo tamanho */}
        <div className="absolute inset-x-0 bottom-0 space-y-2 p-3 sm:p-3.5">
          <p className="text-[13px] leading-tight font-extrabold tracking-wide text-balance break-words text-white uppercase drop-shadow">{title}</p>
          {!locked && progress > 0 && <ProgressBar value={progress} className="h-1 bg-white/20" />}
        </div>
      </div>
      {caption && <p className="mt-2 truncate px-0.5 text-xs text-muted">{caption}</p>}
    </Link>
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
    <CoverCard
      href={`/cursos/${course.id}`}
      title={course.title}
      cover={course.cover_url}
      seed={course.id}
      locked={locked}
      progress={progress}
      free={course.is_free}
      priority={priority}
      caption={locked ? 'Exclusivo para alunos' : `${lessons} aula${lessons === 1 ? '' : 's'}${progress ? ` · ${progress}%` : ''}`}
    />
  );
}
