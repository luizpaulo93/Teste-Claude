import Link from 'next/link';
import { Logo } from '@/components/logo';

/** Moldura simples das páginas públicas de Privacidade e Termos. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/site" aria-label="Início">
            <Logo />
          </Link>
          <nav className="flex gap-4 text-sm text-ink-2">
            <Link href="/site/privacidade" className="hover:text-ink">
              Privacidade
            </Link>
            <Link href="/site/termos" className="hover:text-ink">
              Termos
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">Atualizado em {updated}</p>
        <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-ink-2 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
          {children}
        </div>
      </main>
    </div>
  );
}
