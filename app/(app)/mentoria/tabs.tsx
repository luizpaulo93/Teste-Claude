'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/** Abas da mentoria (rolam de lado no celular). */
export function MentoriaTabs({ base, tabs }: { base: string; tabs: { href: string; label: string; badge?: number }[] }) {
  const path = usePathname();
  return (
    <nav className="rail -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      {tabs.map((t) => {
        const href = `${base}${t.href}`;
        const active = t.href ? path.startsWith(href) : path === base;
        return (
          <Link
            key={t.href}
            href={href}
            scroll={false}
            className={cn('relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition', active ? 'text-brand' : 'text-muted hover:text-ink')}
          >
            {t.label}
            {Boolean(t.badge) && <span className="grid h-4.5 min-w-4.5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{t.badge}</span>}
            {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />}
          </Link>
        );
      })}
    </nav>
  );
}
