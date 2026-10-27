import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';

/** Sessão vencida ou inválida: apaga o cookie e volta para o login. */
export async function GET(request: NextRequest) {
  const res = NextResponse.redirect(new URL('/login', request.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
