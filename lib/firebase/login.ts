'use client';

import type { User } from 'firebase/auth';

/** Envia o token do Firebase ao servidor para criar o cookie de sessão. */
export async function createServerSession(user: User) {
  const token = await user.getIdToken();
  const res = await fetch('/api/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken: token }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Não foi possível entrar.');
}

export function safeNext(next?: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

/** Traduz os erros mais comuns do Firebase Auth. */
export function explainAuthError(e: unknown) {
  const code = String((e as { code?: string })?.code ?? '');
  const msg = e instanceof Error ? e.message : String(e);
  if (code.includes('popup-closed') || code.includes('cancelled-popup')) return '';
  if (code.includes('unauthorized-domain'))
    return 'Este endereço não está autorizado no Firebase. Adicione o domínio em Authentication → Configurações → Domínios autorizados.';
  if (code.includes('operation-not-allowed'))
    return 'Este tipo de login ainda não foi ativado no Firebase (Authentication → Método de login).';
  if (code.includes('invalid-email')) return 'E-mail inválido. Confira se digitou certo.';
  if (code.includes('too-many-requests') || code.includes('quota')) return 'Muitas tentativas seguidas. Aguarde alguns minutos.';
  if (code.includes('invalid-action-code') || code.includes('expired-action-code')) return 'Este link expirou ou já foi usado. Peça um novo.';
  if (code.includes('network')) return 'Sem conexão com a internet. Tente de novo.';
  if (code.includes('account-exists-with-different-credential')) return 'Este e-mail já entrou de outro jeito. Use a mesma forma de login de antes.';
  return msg.replace(/^Firebase: /, '') || 'Não foi possível entrar.';
}

export const EMAIL_KEY = 'vertice_login_email';
