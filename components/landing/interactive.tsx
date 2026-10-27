'use client';

import { ArrowRight, Menu, X } from 'lucide-react';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Logo } from '@/components/logo';
import { buttonClass } from '@/components/ui';
import { Modal } from '@/components/ui-client';
import { LoginForm } from '@/app/login/login-form';
import { cn } from '@/lib/utils';

const LoginCtx = createContext<() => void>(() => {});

/** Envolve a página: abre o login em janela, anima elementos ao rolar e o brilho dos cards. */
export function LandingRoot({ children, brand }: { children: ReactNode; brand: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('entrar')) setOpen(true);
    const els = document.querySelectorAll<HTMLElement>('[data-reveal]');
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );
    els.forEach((el) => io.observe(el));
    const onMove = (e: PointerEvent) => {
      const card = (e.target as HTMLElement)?.closest?.('.lp-card-glow') as HTMLElement | null;
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  return (
    <LoginCtx.Provider value={() => setOpen(true)}>
      {children}
      <Modal open={open} onClose={() => setOpen(false)} size="sm" title={<span className="flex items-center gap-2"><Logo className="size-5" /> Entrar no {brand}</span>}>
        <p className="mb-5 text-sm text-muted">Acesse suas aulas, simulados e mentoria.</p>
        <LoginForm />
      </Modal>
    </LoginCtx.Provider>
  );
}

export function LoginButton({ children, className, variant = 'primary', size = 'md' }: { children: ReactNode; className?: string; variant?: 'primary' | 'outline' | 'secondary' | 'ghost'; size?: 'sm' | 'md' | 'lg' }) {
  const open = useContext(LoginCtx);
  return (
    <button type="button" onClick={open} className={buttonClass(variant, size, className)}>
      {children}
    </button>
  );
}

const LINKS = [
  { href: '#recursos', label: 'Recursos' },
  { href: '#disciplinas', label: 'Disciplinas' },
  { href: '#simulados', label: 'Simulados' },
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#duvidas', label: 'Dúvidas' },
];

export function LandingNav({ brand }: { brand: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <header className={cn('fixed inset-x-0 top-0 z-50 transition-all duration-300', scrolled ? 'border-b border-white/10 bg-[#050912]/75 backdrop-blur-xl' : 'bg-transparent')}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-[72px] sm:px-6 lg:px-8">
        <a href="#topo" className="flex items-center gap-2.5 text-white">
          <Logo className="size-8" />
          <span className="text-sm font-extrabold tracking-wide">{brand}</span>
        </a>
        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-full px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LoginButton size="md" className="rounded-full px-5">
            Entrar <ArrowRight className="size-4" />
          </LoginButton>
          <button type="button" onClick={() => setMenu((v) => !v)} aria-label="Menu" className="grid size-10 place-items-center rounded-full text-white hover:bg-white/10 lg:hidden">
            {menu ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {menu && (
        <div className="animate-slide-up border-t border-white/10 bg-[#050912]/95 px-4 pb-4 backdrop-blur-xl lg:hidden">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setMenu(false)} className="block border-b border-white/5 py-3.5 text-sm font-medium text-white/80">
              {l.label}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}

/** Número que conta até o valor quando aparece na tela. */
export function Counter({ to, suffix = '', prefix = '', duration = 1600 }: { to: number; suffix?: string; prefix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        setVal(Math.round(to * (1 - Math.pow(1 - t, 3))));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);
  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {val.toLocaleString('pt-BR')}
      {suffix}
    </span>
  );
}

/** Cartão-resposta que se preenche sozinho, em loop. */
export function AnimatedBubbles() {
  const answers = 'BDACEABDCE';
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setN((v) => (v >= answers.length + 4 ? 0 : v + 1)), 450);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="grid gap-1.5">
      {answers.split('').map((a, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-6 text-right text-[11px] font-bold text-white/40 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
          {'ABCDE'.split('').map((o) => {
            const on = i < n && o === a;
            return (
              <span
                key={o}
                className={cn(
                  'grid size-7 place-items-center rounded-full border text-[11px] font-bold transition-all duration-300',
                  on ? 'scale-110 border-blue-400 bg-blue-500 text-white shadow-[0_0_14px_rgba(59,130,246,0.7)]' : 'border-white/15 text-white/45',
                )}
              >
                {o}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
