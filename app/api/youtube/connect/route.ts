import { NextResponse, type NextRequest } from 'next/server';
import { getViewer } from '@/lib/session';
import { oauthConfigured, YT_SCOPE } from '@/lib/youtube';

/** Abre a tela do Google para autorizar o app a criar lives no canal. */
export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return NextResponse.redirect(new URL('/', req.url));
  if (!oauthConfigured()) return NextResponse.redirect(new URL('/admin/ao-vivo?yt=sem-config', req.url));
  const state = crypto.randomUUID();
  const redirect = new URL('/api/youtube/callback', req.url).toString();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirect,
    response_type: 'code',
    scope: YT_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  }).toString();
  const res = NextResponse.redirect(url);
  res.cookies.set('yt_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' });
  return res;
}
