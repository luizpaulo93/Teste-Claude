import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="text-6xl font-black text-brand">404</p>
        <p className="mt-3 text-lg font-bold text-ink">Página não encontrada</p>
        <Link href="/" className="mt-5 inline-block text-sm font-semibold text-brand">
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
