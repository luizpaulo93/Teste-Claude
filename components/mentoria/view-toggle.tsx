import Link from 'next/link';
import { cn } from '@/lib/utils';

/** Dia | Semana na agenda da mentoria (mantém o dia escolhido) */
export function ViewToggle({ view, day, base = '/mentoria/agenda' }: { view: 'dia' | 'semana'; day: string; base?: string }) {
  const sep = base.includes('?') ? '&' : '?';
  return (
    <div className="flex justify-end">
      <div className="inline-flex rounded-lg border border-line bg-surface p-0.5" role="tablist" aria-label="Visão da agenda">
        {(['dia', 'semana'] as const).map((v) => (
          <Link
            key={v}
            href={`${base}${sep}v=${v}&d=${day}`}
            scroll={false}
            role="tab"
            aria-selected={view === v}
            className={cn('h-8 rounded-md px-4 text-[13px] leading-8 font-medium transition-colors', view === v ? 'bg-ink text-bg' : 'text-ink-2 hover:text-ink')}
          >
            {v === 'dia' ? 'Dia' : 'Semana'}
          </Link>
        ))}
      </div>
    </div>
  );
}
