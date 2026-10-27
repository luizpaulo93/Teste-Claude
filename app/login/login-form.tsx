'use client';

import { ArrowRight, CheckCircle2, Mail } from 'lucide-react';
import { GoogleAuthProvider, getRedirectResult, sendSignInLinkToEmail, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { buttonClass, Input } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import { clientAuth } from '@/lib/firebase/client';
import { createServerSession, EMAIL_KEY, explainAuthError, safeNext } from '@/lib/firebase/login';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState<'google' | 'email' | 'finish' | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const finish = async (user: Parameters<typeof createServerSession>[0]) => {
    setLoading('finish');
    await createServerSession(user);
    window.location.assign(safeNext(next));
  };

  // Volta de um login por redirecionamento (quando o navegador bloqueia a janela do Google)
  useEffect(() => {
    getRedirectResult(clientAuth())
      .then((r) => r?.user && finish(r.user))
      .catch((e) => setError(explainAuthError(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function google() {
    setLoading('google');
    setError('');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const r = await signInWithPopup(clientAuth(), provider);
      await finish(r.user);
    } catch (e) {
      const code = String((e as { code?: string })?.code ?? '');
      if (code.includes('popup-blocked') || code.includes('operation-not-supported')) {
        await signInWithRedirect(clientAuth(), provider);
        return;
      }
      setError(explainAuthError(e));
      setLoading(null);
    }
  }

  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    setLoading('email');
    setError('');
    try {
      const url = new URL('/login/finalizar', window.location.origin);
      if (next) url.searchParams.set('next', next);
      await sendSignInLinkToEmail(clientAuth(), addr, { url: url.toString(), handleCodeInApp: true });
      try {
        window.localStorage.setItem(EMAIL_KEY, addr);
      } catch {
        /* navegador sem armazenamento */
      }
      setSent(true);
    } catch (err) {
      setError(explainAuthError(err));
    } finally {
      setLoading(null);
    }
  }

  if (sent) {
    return (
      <div className="animate-scale-in rounded-2xl border border-success/30 bg-success/10 p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <p className="mt-3 font-bold text-ink">Confira seu e-mail</p>
        <p className="mt-1 text-sm text-muted">
          Enviamos um link de acesso para <strong className="text-ink">{email}</strong>. Abra no mesmo aparelho. Se não achar, olhe o spam.
        </p>
        <button type="button" onClick={() => setSent(false)} className="mt-4 text-sm font-semibold text-brand">
          Usar outro e-mail
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button type="button" onClick={google} disabled={loading !== null} className={buttonClass('secondary', 'lg', 'w-full bg-surface')}>
        {loading === 'google' || loading === 'finish' ? <Spinner /> : <GoogleIcon />}
        {loading === 'finish' ? 'Entrando…' : 'Continuar com Google'}
      </button>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line-strong" /> ou receba um link por e-mail <span className="h-px flex-1 bg-line-strong" />
      </div>

      <form onSubmit={magicLink} className="space-y-3">
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
          <Input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="seuemail@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 pl-10"
          />
        </div>
        <button type="submit" disabled={loading !== null} className={buttonClass('primary', 'lg', 'w-full')}>
          {loading === 'email' ? <Spinner /> : null}
          Enviar link de acesso <ArrowRight className="size-4" />
        </button>
      </form>
      {error && <p className="text-center text-sm text-danger">{error}</p>}
    </div>
  );
}
