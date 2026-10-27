'use client';

import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/logo';
import { buttonClass, Input } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import { clientAuth } from '@/lib/firebase/client';
import { createServerSession, EMAIL_KEY, explainAuthError, safeNext } from '@/lib/firebase/login';

/** Página aberta pelo link enviado por e-mail: conclui o login. */
export default function FinishLogin() {
  const [state, setState] = useState<'working' | 'ask' | 'error'>('working');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const complete = async (addr: string) => {
    setState('working');
    try {
      const auth = clientAuth();
      const r = await signInWithEmailLink(auth, addr.trim().toLowerCase(), window.location.href);
      try {
        window.localStorage.removeItem(EMAIL_KEY);
      } catch {
        /* ok */
      }
      await createServerSession(r.user);
      window.location.replace(safeNext(new URLSearchParams(window.location.search).get('next')));
    } catch (e) {
      setError(explainAuthError(e));
      setState('error');
    }
  };

  useEffect(() => {
    const auth = clientAuth();
    if (!isSignInWithEmailLink(auth, window.location.href)) {
      setError('Este link não é um link de acesso válido.');
      setState('error');
      return;
    }
    let saved = '';
    try {
      saved = window.localStorage.getItem(EMAIL_KEY) ?? '';
    } catch {
      /* ok */
    }
    if (saved) void complete(saved);
    else setState('ask'); // abriu o link em outro aparelho/navegador
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="grid min-h-dvh place-items-center px-5">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-6 grid size-14 place-items-center rounded-2xl bg-surface text-ink shadow-glow">
          <Logo className="size-8" />
        </div>
        {state === 'working' && (
          <p className="flex items-center justify-center gap-2 text-sm text-muted">
            <Spinner className="text-brand" /> Entrando…
          </p>
        )}
        {state === 'ask' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void complete(email);
            }}
            className="space-y-3 text-left"
          >
            <p className="text-center text-sm text-muted">Confirme o e-mail em que você recebeu o link:</p>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seuemail@exemplo.com" className="h-12" />
            <button type="submit" className={buttonClass('primary', 'lg', 'w-full')}>
              Entrar
            </button>
          </form>
        )}
        {state === 'error' && (
          <div>
            <p className="text-sm text-danger">{error}</p>
            <a href="/login" className="mt-4 inline-block text-sm font-semibold text-brand">
              Voltar para o login
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
