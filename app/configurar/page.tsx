import { hasSupabaseEnv } from '@/lib/supabase/env';
import { redirect } from 'next/navigation';

export default function SetupPage() {
  if (hasSupabaseEnv) redirect('/');
  return (
    <main className="mx-auto max-w-xl px-5 py-16">
      <h1 className="text-2xl font-extrabold text-ink">Falta conectar o Supabase</h1>
      <p className="mt-3 text-sm text-muted">
        Cadastre as variáveis <code className="text-ink">NEXT_PUBLIC_SUPABASE_URL</code> e{' '}
        <code className="text-ink">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> na Vercel (Settings → Environment Variables) e faça um novo deploy.
        O passo a passo completo está no README do repositório.
      </p>
    </main>
  );
}
