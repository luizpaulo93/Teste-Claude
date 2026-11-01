import { NextResponse, type NextRequest } from 'next/server';
import { getViewer } from '@/lib/session';
import { channelOf, exchangeCode, saveAccount, youtubeReason } from '@/lib/youtube';

/** Volta do Google: guarda a autorização (só no servidor) e o nome do canal. */
export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return NextResponse.redirect(new URL('/', req.url));
  const back = (q: string, why = '') => {
    const res = NextResponse.redirect(new URL(`/admin/ao-vivo?yt=${q}${why ? `&m=${encodeURIComponent(why)}` : ''}`, req.url));
    res.cookies.delete('yt_state');
    return res;
  };
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const denied = req.nextUrl.searchParams.get('error');
  if (denied) return back('erro', denied === 'access_denied' ? 'negado' : denied);
  if (!code || !state || state !== req.cookies.get('yt_state')?.value) return back('erro', 'sessao');
  try {
    const redirect = new URL('/api/youtube/callback', req.url).toString();
    const tok = await exchangeCode(code, redirect);
    const ch = await channelOf(tok.access_token!);
    await saveAccount({
      ...(tok.refresh_token ? { refresh_token: tok.refresh_token } : {}),
      access_token: tok.access_token,
      expires_at: Date.now() + (tok.expires_in ?? 3600) * 1000,
      ...ch,
    });
    return back('ok');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[youtube callback]', msg);
    return back('erro', youtubeReason(msg));
  }
}
