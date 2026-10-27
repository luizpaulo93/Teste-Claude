import type { Metadata } from 'next';
import { Logo } from '@/components/logo';
import { getSettings } from '@/lib/session';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Entrar' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string; next?: string }> }) {
  const [{ erro, next }, settings] = await Promise.all([searchParams, getSettings()]);
  return (
    <main className="relative grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden lg:block">
        {settings.hero_bg_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.hero_bg_url} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="hero-fallback absolute inset-0"><div className="hero-grid absolute inset-0" /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <Logo className="size-10" />
            <span className="text-lg font-extrabold tracking-wide">{settings.brand_name}</span>
          </div>
          <div className="max-w-lg animate-slide-up">
            <h1 className="text-4xl leading-tight font-extrabold tracking-tight xl:text-5xl">{settings.hero_title}</h1>
            <p className="mt-4 text-lg text-white/75">{settings.hero_subtitle}</p>
          </div>
        </div>
      </section>

      <section className="relative flex items-center justify-center px-5 py-12">
        <div className="pointer-events-none absolute inset-0 bg-[image:radial-gradient(600px_300px_at_50%_0%,var(--brand-soft),transparent)] lg:hidden" />
        <div className="relative w-full max-w-sm animate-scale-in">
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="mb-5 grid size-14 place-items-center rounded-2xl bg-surface text-ink shadow-glow lg:hidden">
              <Logo className="size-8" />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-ink">Bem-vindo de volta</h2>
            <p className="mt-1.5 text-sm text-muted">Entre para acessar suas aulas, simulados e mentoria.</p>
          </div>
          {erro && (
            <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              O link expirou ou é inválido. Tente novamente.
            </div>
          )}
          <LoginForm next={next} />
          <p className="mt-8 text-center text-xs text-muted">
            Ao entrar, você concorda em não compartilhar seu acesso. Cada conta é individual.
          </p>
        </div>
      </section>
    </main>
  );
}
