import type { Metadata } from 'next';
import { Formulas } from '@/components/brand/formulas';
import { Logo } from '@/components/logo';
import { redirect } from 'next/navigation';
import { getSettings, getViewer } from '@/lib/session';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Entrar' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string; next?: string }> }) {
  const [{ erro, next }, settings, viewer] = await Promise.all([searchParams, getSettings(), getViewer()]);
  if (viewer) redirect(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
  return (
    <main className="relative grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden lg:block">
        {settings.hero_bg_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.hero_bg_url} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="hero-fallback absolute inset-0">
            <Formulas />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <Logo className="size-10" />
            <span className="text-[15px] font-semibold tracking-[0.06em] uppercase">{settings.brand_name}</span>
          </div>
          <div className="max-w-lg animate-slide-up">
            <h1 className="text-4xl leading-[1.05] font-semibold tracking-[-0.035em] xl:text-5xl">{settings.hero_title}</h1>
            <p className="mt-4 text-base text-white/65">{settings.hero_subtitle}</p>
          </div>
        </div>
      </section>

      <section className="relative flex items-center justify-center px-5 py-12">
        <div className="relative w-full max-w-sm animate-scale-in">
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="mb-5 grid size-14 place-items-center rounded-xl border border-line bg-surface text-ink lg:hidden">
              <Logo className="size-8" />
            </div>
            <h2 className="text-2xl font-semibold tracking-[-0.025em] text-ink">Bem-vindo de volta</h2>
            <p className="mt-1.5 text-sm text-muted">Entre para acessar suas aulas, simulados e mentoria.</p>
          </div>
          {erro && (
            <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              Não foi possível concluir o login. Tente novamente.
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
