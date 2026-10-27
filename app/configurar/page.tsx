import { AlertTriangle } from 'lucide-react';
import { redirect } from 'next/navigation';
import { supabaseEnvProblem } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

export default function SetupPage() {
  const problem = supabaseEnvProblem();
  if (!problem) redirect('/');
  return (
    <main className="mx-auto max-w-xl px-5 py-16">
      <div className="grid size-12 place-items-center rounded-2xl bg-warning/15 text-warning">
        <AlertTriangle className="size-6" />
      </div>
      <h1 className="mt-5 text-2xl font-extrabold text-ink">Falta ajustar a conexão com o Supabase</h1>
      <p className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm font-semibold text-ink">{problem}</p>
      <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm text-ink-2">
        <li>
          No Supabase: <strong>Project Settings → API</strong>. Copie a <strong>Project URL</strong> e a chave <strong>anon public</strong> (ou{' '}
          <strong>publishable</strong>).
        </li>
        <li>
          Na Vercel: <strong>Settings → Environments → Production → Environment Variables</strong>. Confira{' '}
          <code className="text-ink">NEXT_PUBLIC_SUPABASE_URL</code> e <code className="text-ink">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
        </li>
        <li>
          Faça um <strong>Redeploy</strong> (Deployments → ⋯ → Redeploy). Variáveis novas só valem depois disso.
        </li>
      </ol>
    </main>
  );
}
