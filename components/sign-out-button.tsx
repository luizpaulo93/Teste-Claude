'use client';

import { LogOut } from 'lucide-react';
import { clientAuth } from '@/lib/firebase/client';

/** Sai do Firebase no navegador e apaga o cookie de sessão no servidor. */
export function SignOutButton({ className, label = 'Sair' }: { className?: string; label?: string }) {
  return (
    <form
      action="/auth/signout"
      method="post"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        // sai na hora: espera o Firebase limpar a sessão local por no máximo 0,3 s
        await Promise.race([
          clientAuth()
            .signOut()
            .catch(() => {}),
          new Promise((r) => setTimeout(r, 300)),
        ]);
        form.submit();
      }}
    >
      <button type="submit" className={className}>
        <LogOut className="size-4" /> {label}
      </button>
    </form>
  );
}
