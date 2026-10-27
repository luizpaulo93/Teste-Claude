'use client';

import { ArrowRight, Info, Lock, Play } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { buttonClass } from '@/components/ui';
import { cn } from '@/lib/utils';

export interface HeroSlide {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  image: string;
  href: string;
  cta: string;
  secondaryHref?: string;
  locked?: boolean;
  resume?: boolean;
}

/** Abertura em tela cheia com troca automática (estilo streaming). */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [i, setI] = useState(0);
  const paused = useRef(false);
  const touchX = useRef<number | null>(null);
  const n = slides.length;
  const go = useCallback((k: number) => setI(((k % n) + n) % n), [n]);

  useEffect(() => {
    if (n < 2) return;
    const t = window.setInterval(() => !paused.current && setI((v) => (v + 1) % n), 7000);
    return () => window.clearInterval(t);
  }, [n]);

  return (
    <section
      className="relative left-1/2 -mt-5 w-screen -translate-x-1/2 overflow-hidden sm:-mt-8 lg:w-[calc(100vw-16rem)]"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
      aria-roledescription="carrossel"
    >
      <div className="relative h-[68svh] min-h-[440px] max-h-[720px] sm:h-[62vh]">
        {slides.map((s, k) => (
          <div key={s.id} aria-hidden={k !== i} className={cn('absolute inset-0 transition-opacity duration-1000', k === i ? 'opacity-100' : 'pointer-events-none opacity-0')}>
            {s.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.image}
                alt=""
                loading={k === 0 ? 'eager' : 'lazy'}
                fetchPriority={k === 0 ? 'high' : 'auto'}
                className={cn('absolute inset-0 size-full object-cover transition-transform duration-[8000ms] ease-out', k === i ? 'scale-105' : 'scale-100')}
              />
            ) : (
              <div className="hero-fallback absolute inset-0">
                <div className="hero-grid absolute inset-0" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20 lg:px-10">
              <div key={k === i ? `on-${i}` : 'off'} className="max-w-xl">
                <p className="animate-slide-up text-xs font-bold tracking-[0.2em] text-white/70 uppercase">{s.eyebrow}</p>
                <h1 className="animate-slide-up mt-3 text-4xl leading-[1.02] font-black tracking-tight text-white sm:text-5xl lg:text-6xl" style={{ animationDelay: '80ms' }}>
                  {s.title}
                </h1>
                {s.subtitle && (
                  <p className="animate-slide-up mt-4 line-clamp-3 text-sm text-white/75 sm:text-base" style={{ animationDelay: '160ms' }}>
                    {s.subtitle}
                  </p>
                )}
                <div className="animate-slide-up mt-7 flex flex-wrap gap-3" style={{ animationDelay: '240ms' }}>
                  <Link href={s.href} className={buttonClass('primary', 'lg', '!rounded-full px-7')}>
                    {s.locked ? <Lock className="size-4" /> : s.resume ? <Play className="size-4 fill-current" /> : <ArrowRight className="size-4" />}
                    {s.cta}
                  </Link>
                  {s.secondaryHref && (
                    <Link href={s.secondaryHref} className={buttonClass('outline', 'lg', '!rounded-full border-white/25 bg-white/10 px-6 text-white backdrop-blur hover:bg-white/20')}>
                      <Info className="size-4" /> Detalhes
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        {n > 1 && (
          <div className="absolute inset-x-0 bottom-6 flex justify-center gap-2 sm:bottom-8">
            {slides.map((s, k) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Destaque ${k + 1}`}
                onClick={() => go(k)}
                className={cn('h-1.5 rounded-full transition-all duration-500', k === i ? 'w-8 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70')}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
