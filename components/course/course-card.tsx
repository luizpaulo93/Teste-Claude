import { Lock, Play } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Img, ProgressBar } from '@/components/ui';
import type { Course } from '@/lib/types';
import { cn } from '@/lib/utils';

/** 10 cores padrão das capas: tons sóbrios e foscos (cada um do escuro para o mesmo tom, sem neon nem roxo). */
export const GRADIENTS = [
  'from-[#0e1730] to-[#1f3d82]',
  'from-[#0b111f] to-[#1b2c52]',
  'from-[#0a1719] to-[#164a4f]',
  'from-[#101318] to-[#2b3443]',
  'from-[#0b1610] to-[#1e4a33]',
  'from-[#111114] to-[#36363e]',
  'from-[#190c0e] to-[#5c1f27]',
  'from-[#19120a] to-[#6b4a14]',
  'from-[#0f130b] to-[#3e4b21]',
  'from-[#13110f] to-[#4b4641]',
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
    <div className={cn('absolute inset-0 bg-gradient-to-b', g, className)}>
      {/* quadriculado de caderno + o vértice da marca bem apagado: capa com cara de material de estudo */}
      <div className="absolute inset-0 bg-[image:linear-gradient(rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.05)_1px,transparent_1px)] bg-[size:20px_20px]" />
      <Logo className="absolute -top-[8%] -right-[14%] w-[78%] text-white/[0.07]" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="line-clamp-3 text-lg leading-tight font-semibold text-white drop-shadow">{title}</p>
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
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-line bg-surface-2 shadow-card transition-all duration-300 group-hover:-translate-y-1 group-hover:border-line-strong group-focus-visible:">
        {coverImage(cover) ? (
          <Img
            src={coverImage(cover)}
            loading={priority ? 'eager' : 'lazy'}
            className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <CoverFallback title="" seed={seed} color={coverColor(cover)} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
        {free && (
          <div className="absolute top-2.5 left-2.5">
            <span className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-[0.06em] text-black uppercase">Grátis</span>
          </div>
        )}
        {locked ? (
          <div className="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur">
            <Lock className="size-4" />
          </div>
        ) : (
          <div className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span className="grid size-12 place-items-center rounded-full bg-white/95 text-black">
              <Play className="ml-0.5 size-5 fill-current" />
            </span>
          </div>
        )}
        {/* Nome completo na capa, sempre do mesmo tamanho */}
        <div className="absolute inset-x-0 bottom-0 space-y-2 p-3 sm:p-3.5">
          <p className="text-[15px] leading-[1.15] font-semibold tracking-[-0.01em] text-balance break-words text-white">{title}</p>
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
