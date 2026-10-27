import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabaseEnv } from './env';

const PUBLIC_PATHS = ['/login', '/auth', '/configurar', '/site'];

export async function updateSession(request: NextRequest) {
  try {
    return await handle(request);
  } catch (e) {
    // Nunca derruba o site: registra o erro e segue sem checar a sessão
    console.error('[proxy] falha ao verificar sessão:', e instanceof Error ? e.message : e);
    const path = request.nextUrl.pathname;
    if (path === '/') return NextResponse.rewrite(new URL('/site', request.url));
    return NextResponse.next();
  }
}

async function handle(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (!hasSupabaseEnv) {
    if (path.startsWith('/configurar')) return NextResponse.next();
    return NextResponse.redirect(new URL('/configurar', request.url));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getClaims valida o JWT (localmente quando o projeto usa chaves assimétricas) e renova o token.
  const { data } = await supabase.auth.getClaims();
  const isLogged = Boolean(data?.claims?.sub);
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  // Visitante na raiz vê a página de apresentação (a URL continua "/")
  if (!isLogged && path === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/site';
    const rewrite = NextResponse.rewrite(url);
    response.cookies.getAll().forEach((c) => rewrite.cookies.set(c));
    return rewrite;
  }
  if (isLogged && path === '/site') {
    return NextResponse.redirect(new URL('/', request.url));
  }
  if (!isLogged && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = path !== '/' ? `?next=${encodeURIComponent(path)}` : '';
    return NextResponse.redirect(url);
  }
  if (isLogged && path === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return response;
}
