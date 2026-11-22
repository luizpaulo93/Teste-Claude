'use client';

import {
  BarChart3,
  ChevronDown,
  CalendarDays,
  ClipboardCheck,
  Compass,
  FileQuestion,
  Heart,
  Home,
  Menu,
  MessageCircleQuestion,
  Moon,
  Radio,
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
import { InstallApp } from '@/components/install-app';
import { SignOutButton } from '@/components/sign-out-button';
import { cn } from '@/lib/utils';
import { ADMIN_TABS } from '@/app/(app)/admin/admin-nav';

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  show?: boolean;
  /** bolinha vermelha de novidade */
  dot?: boolean;
  /** selo AO VIVO (aula acontecendo agora) */
  live?: boolean;
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
  canQuestoes = isMember,
  hasMentoria,
  liveNow = false,
  mentoriaAlert = 0,
  news = { simulados: false, calendario: false },
}: {
  children: ReactNode;
  brand: string;
  user: { name: string; email: string; avatar: string };
  isAdmin: boolean;
  isMember: boolean;
  canQuestoes?: boolean;
  hasMentoria: boolean;
  liveNow?: boolean;
  mentoriaAlert?: number;
  news?: { simulados: boolean; calendario: boolean };
}) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // seção aberta nesta visita: a bolinha some na hora (o layout só recarrega no próximo acesso)
  const [seen, setSeen] = useState<string[]>([]);
  useEffect(() => {
    setMoreOpen(false);
    setMenuOpen(false);
    for (const s of ['/simulados', '/calendario']) if (pathname.startsWith(s)) setSeen((v) => (v.includes(s) ? v : [...v, s]));
  }, [pathname]);
  const fresh = (href: string, on: boolean) => on && !seen.includes(href) && !pathname.startsWith(href);

  const items: NavItem[] = [
    { href: '/', label: 'Início', icon: Home },
    { href: '/cursos', label: 'Cursos', icon: Compass },
    { href: '/ao-vivo', label: 'Ao vivo', icon: Radio, show: isMember, dot: liveNow, live: liveNow },
    { href: '/minhas-aulas', label: 'Minhas aulas', icon: Heart },
    // Desempenho no lugar de Simulados (e Simulados no lugar de Desempenho)
    { href: '/desempenho', label: 'Desempenho', icon: BarChart3, show: isMember },
    { href: '/questoes', label: isAdmin ? 'Questões' : 'Exercícios', icon: FileQuestion, show: canQuestoes },
    { href: '/simulados', label: 'Simulados', icon: ClipboardCheck, show: isMember, dot: fresh('/simulados', news.simulados) },
    { href: '/duvidas', label: 'Dúvidas', icon: MessageCircleQuestion, show: isMember },
    // Mentor vai direto para a gestão da mentoria (com aviso de dúvidas sem resposta)
    { href: isAdmin ? '/admin/mentoria' : '/mentoria', label: 'Mentoria', icon: Target, show: hasMentoria, dot: mentoriaAlert > 0 },
    { href: '/calendario', label: 'Calendário', icon: CalendarDays, dot: fresh('/calendario', news.calendario) },
  ].filter((i) => i.show !== false);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const inAdmin = pathname.startsWith('/admin');
  // Admin: a lateral tem dois menus que abrem e fecham (abrir um recolhe o outro)
  const [section, setSection] = useState<'geral' | 'admin' | null>(inAdmin ? 'admin' : 'geral');
  const toggleSection = (s: 'geral' | 'admin') => setSection((v) => (v === s ? null : s));
  const adminActive = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href));

  // Sempre 4 atalhos + "Mais": primeiro os preferidos, depois completa com os outros
  // Dúvidas no menu de baixo; Calendário fica no "Mais" (entra só se faltar atalho)
  const preferred = liveNow ? ['/', '/cursos', '/ao-vivo', '/duvidas', '/desempenho', '/calendario'] : ['/', '/cursos', '/desempenho', '/duvidas', '/calendario'];
  const mobileMain = [...preferred.map((h) => items.find((i) => i.href === h)).filter(Boolean), ...items.filter((i) => !preferred.includes(i.href))].slice(
    0,
    4,
  ) as NavItem[];
  // Minhas aulas e Perfil ficam no menu da foto (topo)
  const mobileMore = items.filter((i) => !mobileMain.includes(i) && i.href !== '/minhas-aulas');
  // novidade guardada dentro do "Mais": bolinha no botão também
  const moreDot = mobileMore.some((i) => i.dot);

  return (
    <div className="min-h-dvh">
      {/* Sidebar desktop */}
      <aside data-chrome className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-bg-elev/80 backdrop-blur-xl lg:flex">
        <Link href="/" className="flex h-16 items-center gap-3 px-6">
          <Logo className="size-8 text-ink" />
          <span className="truncate text-[13px] font-semibold tracking-[0.04em] text-ink uppercase">{brand}</span>
        </Link>
        <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {isAdmin ? (
            <>
              <Section title="Geral" icon={Home} open={section === 'geral'} onToggle={() => toggleSection('geral')}>
                {items.map((item) => (
                  <NavLink key={item.href} item={item} active={isActive(item.href)} />
                ))}
              </Section>
              <Section title="Admin" icon={Shield} open={section === 'admin'} onToggle={() => toggleSection('admin')} dot={mentoriaAlert > 0}>
                {ADMIN_TABS.map((t) => (
                  <NavLink
                    key={t.href}
                    item={{ href: t.href, label: t.label, icon: t.icon, dot: t.href === '/admin/mentoria' && mentoriaAlert > 0 }}
                    active={adminActive(t.href)}
                  />
                ))}
              </Section>
            </>
          ) : (
            items.map((item) => <NavLink key={item.href} item={item} active={isActive(item.href)} />)
          )}
        </nav>
        <div className="border-t border-line p-3">
          <InstallApp className="mb-2" />
          <Link href="/perfil" className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-surface-2">
            <Avatar name={user.name} src={user.avatar} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
          </Link>
          <div className="mt-2 flex gap-1">
            <button
              type="button"
              onClick={toggle}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium text-ink-2 hover:bg-surface-2"
            >
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
              {theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            </button>
            <div className="flex-1">
              <SignOutButton className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium text-ink-2 hover:bg-surface-2 hover:text-danger" />
            </div>
          </div>
        </div>
      </aside>

      {/* Topbar mobile/tablet */}
      <header data-chrome className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-bg/80 px-4 backdrop-blur-xl lg:hidden">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <Logo className="size-7 text-ink" />
          <span className="truncate text-sm font-semibold tracking-wide text-ink">{brand}</span>
        </Link>
        <div className="relative flex items-center gap-1">
          <button type="button" onClick={toggle} aria-label="Alternar tema" className="grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-surface-2">
            {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
          </button>
          <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-label="Conta" className="rounded-full p-0.5">
            <Avatar name={user.name} src={user.avatar} size={32} />
          </button>
          {menuOpen && (
            <div className="absolute top-12 right-0 w-60 animate-scale-in overflow-hidden rounded-xl border border-line-strong bg-surface shadow-2xl">
              <div className="border-b border-line px-4 py-3">
                <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                <p className="truncate text-xs text-muted">{user.email}</p>
              </div>
              <Link href="/perfil" className="flex items-center gap-2.5 px-4 py-3 text-sm text-ink-2 hover:bg-surface-2">
                <User className="size-4" /> Meu perfil
              </Link>
              <Link href="/minhas-aulas" className="flex items-center gap-2.5 px-4 py-3 text-sm text-ink-2 hover:bg-surface-2">
                <Heart className="size-4" /> Minhas aulas
              </Link>
              {isAdmin && (
                <Link href="/admin" className="flex items-center gap-2.5 px-4 py-3 text-sm text-ink-2 hover:bg-surface-2">
                  <Settings2 className="size-4" /> Painel admin
                </Link>
              )}
              <SignOutButton className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-danger hover:bg-surface-2" />
            </div>
          )}
        </div>
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-7xl px-4 pt-5 pb-28 sm:px-6 sm:pt-8 lg:px-10 lg:pb-12">{children}</div>
      </main>

      {/* Bottom nav mobile */}
      <nav data-chrome className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg-elev/90 backdrop-blur-xl safe-bottom lg:hidden">
        <div className="mx-auto grid max-w-lg justify-items-center md:max-w-3xl" style={{ gridTemplateColumns: `repeat(${mobileMain.length + 1}, minmax(0, 1fr))` }}>
          {mobileMain.map((item) => (
            <BottomLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn('flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium', moreOpen ? 'text-ink' : 'text-muted')}
          >
            <span className="relative">
              <Menu className="size-5" />
              {moreDot && <span aria-label="Novidade" className="absolute -top-0.5 -right-1 size-2 animate-pulse rounded-full bg-red-500 ring-2 ring-bg-elev" />}
            </span>
            Mais
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-black/50" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 animate-slide-up rounded-t-2xl border-t border-line-strong bg-surface p-4 safe-bottom">
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-sm font-bold text-ink">Menu</span>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setMoreOpen(false)}
                className="grid size-9 place-items-center rounded-xl hover:bg-surface-2"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 pb-2">
              {[...mobileMore, ...(isAdmin ? [{ href: '/admin', label: 'Admin', icon: Shield }] : [])].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative flex flex-col items-center gap-2 rounded-lg border p-4 text-xs font-medium',
                    isActive(item.href) ? 'border-line-strong bg-surface-3 text-ink' : 'border-line bg-surface-2 text-ink-2',
                  )}
                >
                  {'dot' in item && item.dot && (
                    <span aria-label="Novidade" className="absolute top-2 right-2 size-2.5 animate-pulse rounded-full bg-red-500" />
                  )}
                  <item.icon className="size-5" />
                  {item.label}
                </Link>
              ))}
              <InstallApp compact />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Menu da lateral que abre e fecha (Geral / Admin) */
function Section({
  title,
  icon: Icon,
  open,
  onToggle,
  dot,
  children,
}: {
  title: string;
  icon: typeof Home;
  open: boolean;
  onToggle: () => void;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="pb-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 font-mono text-[11px] font-medium tracking-[0.08em] uppercase transition-colors',
          open ? 'text-ink' : 'text-muted hover:bg-surface-2/70 hover:text-ink',
        )}
      >
        <Icon className="size-[15px] shrink-0" strokeWidth={1.75} />
        {title}
        {!open && dot && <span aria-label="Novidade" className="size-1.5 rounded-full bg-red-500" />}
        <ChevronDown className={cn('ml-auto size-4 transition-transform duration-200', open ? 'rotate-180' : '')} />
      </button>
      <div className={cn('grid transition-[grid-template-rows] duration-200 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className={cn('min-h-0 space-y-1 overflow-hidden', open ? 'pt-1' : '')} inert={!open}>
          {children}
        </div>
      </div>
    </div>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        // item ativo: fundo neutro e texto forte (sem tinta azul nem bolinha); o ícone ganha a cor da marca
        'group flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors',
        active ? 'bg-surface-2 text-ink shadow-[inset_0_0_0_1px_var(--line)]' : 'text-ink-2 hover:bg-surface-2/70 hover:text-ink',
      )}
    >
      <item.icon className={cn('size-[17px] shrink-0', active ? 'text-brand' : 'text-muted group-hover:text-ink-2')} strokeWidth={1.75} />
      {item.label}
      {item.live ? (
        <span className="ml-auto flex items-center gap-1 font-mono text-[9.5px] font-medium tracking-[0.06em] text-red-500 uppercase">
          <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
          Ao vivo
        </span>
      ) : (
        item.dot && <span aria-label="Novidade" className="ml-auto size-1.5 rounded-full bg-red-500" />
      )}
    </Link>
  );
}

function BottomLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn('relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors', active ? 'text-ink' : 'text-muted')}
    >
      {active && <span className="absolute top-0 h-0.5 w-6 rounded-full bg-brand" />}
      <span className="relative">
        <item.icon className="size-5" />
        {item.dot && <span aria-label="Novidade" className="absolute -top-0.5 -right-1 size-2 animate-pulse rounded-full bg-red-500 ring-2 ring-bg-elev" />}
      </span>
      {item.label}
    </Link>
  );
}
