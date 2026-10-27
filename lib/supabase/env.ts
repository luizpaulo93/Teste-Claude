// Limpa espaços, quebras de linha e aspas que costumam vir junto ao colar na Vercel.
function clean(v: string | undefined) {
  return (v ?? '').trim().replace(/^["']|["']$/g, '').trim();
}

export const SUPABASE_URL = clean(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, '');
export const SUPABASE_ANON_KEY = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) || clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

function jwtRole(key: string) {
  try {
    const part = key.split('.')[1];
    const json = JSON.parse(typeof atob === 'function' ? atob(part.replace(/-/g, '+').replace(/_/g, '/')) : Buffer.from(part, 'base64url').toString());
    return String(json.role ?? '');
  } catch {
    return '';
  }
}

/** Explica o que está errado nas variáveis do Supabase (ou null se estiver tudo certo). */
export function supabaseEnvProblem(): string | null {
  if (!SUPABASE_URL && !SUPABASE_ANON_KEY) return 'As variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY não foram encontradas.';
  if (!SUPABASE_URL) return 'A variável NEXT_PUBLIC_SUPABASE_URL não foi encontrada.';
  if (!SUPABASE_ANON_KEY) return 'A variável NEXT_PUBLIC_SUPABASE_ANON_KEY não foi encontrada.';
  let url: URL;
  try {
    url = new URL(SUPABASE_URL);
  } catch {
    return 'NEXT_PUBLIC_SUPABASE_URL não é um endereço válido. Ele deve ser como https://abcdefgh.supabase.co';
  }
  if (url.protocol !== 'https:' && url.hostname !== '127.0.0.1' && url.hostname !== 'localhost')
    return 'NEXT_PUBLIC_SUPABASE_URL deve começar com https://';
  if (url.pathname !== '/' && url.pathname !== '')
    return 'NEXT_PUBLIC_SUPABASE_URL deve ter só o endereço do projeto, sem nada depois de .supabase.co (ex.: https://abcdefgh.supabase.co).';
  if (SUPABASE_ANON_KEY.startsWith('http')) return 'NEXT_PUBLIC_SUPABASE_ANON_KEY parece ser um endereço. Cole ali a chave "anon public" (ou "publishable"), e não a URL.';
  if (SUPABASE_ANON_KEY.startsWith('sb_secret_') || jwtRole(SUPABASE_ANON_KEY) === 'service_role')
    return 'Você colou a chave secreta (service_role/secret). Troque pela chave "anon public" (ou "publishable") — a secreta nunca pode ficar no site.';
  if (/\s/.test(SUPABASE_ANON_KEY)) return 'NEXT_PUBLIC_SUPABASE_ANON_KEY tem espaços no meio. Copie a chave de novo.';
  return null;
}

export const hasSupabaseEnv = supabaseEnvProblem() === null;
