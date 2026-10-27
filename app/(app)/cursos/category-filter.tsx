import Link from 'next/link';
import { cn } from '@/lib/utils';

export function CategoryFilter({ categories, active }: { categories: string[]; active?: string }) {
  const chip = (label: string, href: string, on: boolean) => (
    <Link
      key={href}
      href={href}
      scroll={false}
      className={cn(
        'shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition',
        on ? 'border-brand bg-brand text-white' : 'border-line-strong text-ink-2 hover:bg-surface-2',
      )}
    >
      {label}
    </Link>
  );
  return (
    <div className="rail -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {chip('Todos', '/cursos', !active)}
      {categories.map((c) => chip(c, `/cursos?c=${encodeURIComponent(c)}`, active === c))}
    </div>
  );
}
