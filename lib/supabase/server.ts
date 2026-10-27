import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env';

/** Um cliente por requisição (React cache), respeitando a RLS do usuário logado. */
export const createClient = cache(async () => {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chamado de um Server Component: o proxy já renova a sessão.
        }
      },
    },
  });
});
