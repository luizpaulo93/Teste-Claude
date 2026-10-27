'use client';

import { Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { buttonClass, Input } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import { createClient } from '@/lib/supabase/client';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}

/** Traduz os erros mais comuns do Supabase Auth para algo que dá para resolver. */
function explainAuthError(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes('not authorized') || m.includes('not_authorized'))
    return 'Este e-mail não está autorizado pelo servidor de e-mail padrão do Supabase (ele só envia para a equipe do projeto). Configure um SMTP próprio no Supabase ou entre com o Google.';
  if (m.includes('rate limit') || m.includes('rate_limit') || m.includes('too many'))
    return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.';
  if (m.includes('signups not allowed') || m.includes('signup is disabled') || m.includes('signups_disabled'))
    return 'Novos cadastros estão desativados no Supabase (Authentication → Sign In / Providers → "Allow new users to sign up").';
  if (m.includes('provider is not enabled') || m.includes('unsupported provider'))
    return 'Este tipo de login ainda não foi ativado no Supabase (Authentication → Sign In / Providers).';
  if (m.includes('invalid') && m.includes('email')) return 'E-mail inválido. Confira se digitou certo.';
  if (m.includes('smtp') || m.includes('sending') || m.includes('send'))
    return `O Supabase não conseguiu enviar o e-mail (${msg}). Confira as configurações de SMTP.`;
  return `Não foi possível concluir: ${msg}`;
}

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState<'google' | 'email' | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const redirectTo = () => {
    const url = new URL('/auth/callback', window.location.origin);
    if (next) url.searchParams.set('next', next);
    return url.toString();
  };

  async function google() {
    setLoading('google');
    setError('');
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo(), queryParams: { prompt: 'select_account' } },
    });
    if (error) {
      setError(explainAuthError(error.message));
      setLoading(null);
    }
  }

  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading('email');
    setError('');
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirectTo() },
    });
    setLoading(null);
    if (error) setError(explainAuthError(error.message));
    else setSent(true);
  }

  if (sent) {
    return (
      <div className="animate-scale-in rounded-2xl border border-success/30 bg-success/10 p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <p className="mt-3 font-bold text-ink">Confira seu e-mail</p>
        <p className="mt-1 text-sm text-muted">
          Enviamos um link de acesso para <strong className="text-ink">{email}</strong>.
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
        {loading === 'google' ? <Spinner /> : <GoogleIcon />}
        Continuar com Google
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
