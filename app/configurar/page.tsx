import { AlertTriangle } from 'lucide-react';
import { redirect } from 'next/navigation';
import { adminConfigProblem } from '@/lib/firebase/admin-config';
import { publicConfigProblem } from '@/lib/firebase/config';
import { databaseConfigProblem } from '@/lib/db-config';

export const dynamic = 'force-dynamic';

export default function SetupPage() {
  const problems = [publicConfigProblem(), adminConfigProblem(), databaseConfigProblem()].filter(Boolean) as string[];
  if (!problems.length) redirect('/');
  return (
    <main className="mx-auto max-w-xl px-5 py-16">
      <div className="grid size-12 place-items-center rounded-2xl bg-warning/15 text-warning">
        <AlertTriangle className="size-6" />
      </div>
      <h1 className="mt-5 text-2xl font-extrabold text-ink">Falta ajustar a configuração</h1>
      {problems.map((p) => (
        <p key={p} className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm font-semibold text-ink">
          {p}
        </p>
      ))}
      <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm text-ink-2">
        <li>
          Siga o passo a passo dos arquivos <strong>docs/NEON.md</strong> (banco) e <strong>docs/FIREBASE.md</strong> (login) no repositório.
        </li>
        <li>
          Na Vercel: <strong>Settings → Environments → Production → Environment Variables</strong>. Confira{' '}
          <code className="text-ink">DATABASE_URL</code>, <code className="text-ink">NEXT_PUBLIC_FIREBASE_CONFIG</code> e{' '}
          <code className="text-ink">FIREBASE_SERVICE_ACCOUNT</code>.
        </li>
        <li>
          Faça um <strong>Redeploy</strong> (Deployments → ⋯ → Redeploy). Variáveis novas só valem depois disso.
        </li>
      </ol>
    </main>
  );
}
