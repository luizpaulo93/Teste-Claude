'use client';

import {
  CalendarDays,
  ClipboardCheck,
  Compass,
  Heart,
  Home,
  LogOut,
  Menu,
  MessageCircleQuestion,
  Moon,
  Settings2,
  Shield,
  Sun,
  Target,
  User,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Logo } from '@/components/logo';
import { Avatar } from '@/components/ui';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  show?: boolean;
}

function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  }, []);
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
    setTheme(next);
  };
  return { theme, toggle };
}

export function AppShell({
  children,
  brand,
  user,
  isAdmin,
  isMember,
  hasMentoria,
}: {
  children: ReactNode;
  brand: string;
  user: { name: string; email: string; avatar: string };
  isAdmin: boolean;
  isMember: boolean;
  hasMentoria: boolean;
}) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  const items: NavItem[] = [
    { href: '/', label: 'Início', icon: Home },
    { href: '/cursos', label: 'Cursos', icon: Compass },
    { href: '/minhas-aulas', label: 'Minhas aulas', icon: Heart },
    { href: '/simulados', label: 'Simulados', icon: ClipboardCheck, show: isMember },
    { href: '/duvidas', label: 'Dúvidas', icon: MessageCircleQuestion, show: isMember },
    { href: '/mentoria', label: 'Mentoria', icon: Target, show: hasMentoria },
    { href: '/calendario', label: 'Calendário', icon: CalendarDays },
  ].filter((i) => i.show !== false);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const inAdmin = pathname.startsWith('/admin');

  const mobileMain = items.filter((i) => ['/', '/cursos', '/simulados', '/duvidas'].includes(i.href)).slice(0, 4);
  const mobileMore = items.filter((i) => !mobileMain.includes(i));

  return (
    <div className="min-h-dvh">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-bg-elev/80 backdrop-blur-xl lg:flex">
        <Link href="/" className="flex h-16 items-center gap-3 px-6">
          <Logo className="size-8 text-ink" />
          <span className="truncate text-sm font-extrabold tracking-wide text-ink">{brand}</span>
        </Link>
        <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
          {isAdmin && (
            <>
              <div className="px-3 pt-6 pb-2 text-[11px] font-bold tracking-wider text-muted uppercase">Gestão</div>
              <NavLink item={{ href: '/admin', label: 'Painel admin', icon: Shield }} active={inAdmin} />
            </>
          )}
        </nav>
        <div className="border-t border-line p-3">
          <Link href="/perfil" className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-surface-2">
            <Avatar name={user.name} src={user.avatar} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
          </Link>
          <div className="mt-2 flex gap-1">
            <button type="button" onClick={toggle} className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold text-ink-2 hover:bg-surface-2">
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
              {theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            </button>
            <form action="/auth/signout" method="post" className="flex-1">
              <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold text-ink-2 hover:bg-surface-2 hover:text-danger">
                <LogOut className="size-4" /> Sair
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Topbar mobile/tablet */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-bg/80 px-4 backdrop-blur-xl lg:hidden">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <Logo className="size-7 text-ink" />
          <span className="truncate text-sm font-extrabold tracking-wide text-ink">{brand}</span>
        </Link>
        <div className="relative flex items-center gap-1">
          <button type="button" onClick={toggle} aria-label="Alternar tema" className="grid size-9 place-items-center rounded-xl text-ink-2 hover:bg-surface-2">
            {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
          </button>
          <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-label="Conta" className="rounded-full p-0.5">
            <Avatar name={user.name} src={user.avatar} size={32} />
          </button>
          {menuOpen && (
            <div className="absolute top-12 right-0 w-60 animate-scale-in overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-2xl">
              <div className="border-b border-line px-4 py-3">
                <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                <p className="truncate text-xs text-muted">{user.email}</p>
              </div>
              <Link href="/perfil" className="flex items-center gap-2.5 px-4 py-3 text-sm text-ink-2 hover:bg-surface-2">
                <User className="size-4" /> Meu perfil
              </Link>
              {isAdmin && (
                <Link href="/admin" className="flex items-center gap-2.5 px-4 py-3 text-sm text-ink-2 hover:bg-surface-2">
                  <Settings2 className="size-4" /> Painel admin
                </Link>
              )}
              <form action="/auth/signout" method="post">
                <button type="submit" className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-danger hover:bg-surface-2">
                  <LogOut className="size-4" /> Sair
                </button>
              </form>
            </div>
          )}
        </div>
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-7xl px-4 pt-5 pb-28 sm:px-6 sm:pt-8 lg:px-10 lg:pb-12">{children}</div>
      </main>

      {/* Bottom nav mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg-elev/90 backdrop-blur-xl safe-bottom lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {mobileMain.map((item) => (
            <BottomLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn('flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold', moreOpen ? 'text-brand' : 'text-muted')}
          >
            <Menu className="size-5" />
            Mais
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-black/50" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 animate-slide-up rounded-t-3xl border-t border-line-strong bg-surface p-4 safe-bottom">
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-sm font-bold text-ink">Menu</span>
              <button type="button" aria-label="Fechar" onClick={() => setMoreOpen(false)} className="grid size-9 place-items-center rounded-xl hover:bg-surface-2">
                <X className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 pb-2">
              {[...mobileMore, { href: '/perfil', label: 'Perfil', icon: User }, ...(isAdmin ? [{ href: '/admin', label: 'Admin', icon: Shield }] : [])].map(
                (item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-2xl border border-line p-4 text-xs font-semibold',
                      isActive(item.href) ? 'bg-brand-soft text-brand' : 'bg-surface-2 text-ink-2',
                    )}
                  >
                    <item.icon className="size-5" />
                    {item.label}
                  </Link>
                ),
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all',
        active ? 'bg-brand-soft text-brand' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
      )}
    >
      <item.icon className={cn('size-[18px] transition-transform group-hover:scale-110', active && 'text-brand')} />
      {item.label}
      {active && <span className="ml-auto size-1.5 rounded-full bg-brand" />}
    </Link>
  );
}

function BottomLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn('relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors', active ? 'text-brand' : 'text-muted')}
    >
      {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-brand" />}
      <item.icon className="size-5" />
      {item.label}
    </Link>
  );
}

