'use client';

import { BarChart3, BookOpen, CalendarDays, ClipboardCheck, Settings, Target, Users, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/admin', label: 'Visão geral', icon: BarChart3 },
  { href: '/admin/cursos', label: 'Cursos', icon: BookOpen },
  { href: '/admin/alunos', label: 'Alunos', icon: Users },
  { href: '/admin/turmas', label: 'Turmas', icon: UsersRound },
  { href: '/admin/simulados', label: 'Simulados', icon: ClipboardCheck },
  { href: '/admin/calendario', label: 'Calendário', icon: CalendarDays },
  { href: '/admin/mentoria', label: 'Mentoria', icon: Target },
  { href: '/admin/config', label: 'Configurações', icon: Settings },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <div className="rail -mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      {TABS.map((t) => {
        const active = t.href === '/admin' ? pathname === '/admin' : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition',
              active ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            <t.icon className="size-4" /> {t.label}
          </Link>
        );
      })}
    </div>
  );
}
