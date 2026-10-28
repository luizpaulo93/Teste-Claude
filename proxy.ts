import { NextResponse, type NextRequest } from 'next/server';
import { adminConfigProblem } from '@/lib/firebase/admin-config';
import { publicConfigProblem } from '@/lib/firebase/config';
import { databaseConfigProblem } from '@/lib/db-config';

const PUBLIC_PATHS = ['/login', '/auth', '/configurar', '/site', '/api/'];
const SESSION_COOKIE = '__session';

/**
 * Leve de propósito: só confere se existe o cookie de sessão.
 * A validação de verdade (assinatura, validade) acontece no servidor ao montar cada página.
 */
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  try {
    if (publicConfigProblem() || adminConfigProblem() || databaseConfigProblem()) {
      if (path.startsWith('/configurar')) return NextResponse.next();
      return NextResponse.redirect(new URL('/configurar', request.url));
    }
    const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
    const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

    // Visitante na raiz vê a página de apresentação (a URL continua "/")
    if (!hasSession && path === '/') return NextResponse.rewrite(new URL('/site', request.url));
    if (hasSession && path === '/site') return NextResponse.redirect(new URL('/', request.url));
    if (!hasSession && !isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.search = `?next=${encodeURIComponent(path)}`;
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  } catch (e) {
    console.error('[proxy]', e instanceof Error ? e.message : e);
    return path === '/' ? NextResponse.rewrite(new URL('/site', request.url)) : NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
