import { NextResponse, type NextRequest } from 'next/server';
import { getViewer } from '@/lib/session';
import { getIngest } from '@/lib/youtube';

export const maxDuration = 20;

// Endereço de envio por live (cache curto na memória da função)
const cache = new Map<string, { url: string; at: number }>();

/**
 * Recebe um segmento .ts do estúdio (navegador) e repassa ao YouTube por HLS,
 * seguido da playlist atualizada. A chave do YouTube nunca vai para o navegador.
 */
export async function POST(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  const live = req.nextUrl.searchParams.get('live') ?? '';
  const file = req.nextUrl.searchParams.get('file') ?? '';
  if (!/^[\w-]{1,64}$/.test(live) || !/^seg\d{1,7}\.ts$/.test(file)) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });

  let base = cache.get(live);
  if (!base || Date.now() - base.at > 60_000) {
    base = { url: await getIngest(live), at: Date.now() };
    cache.set(live, base);
  }
  if (!base.url) return NextResponse.json({ error: 'Transmissão não preparada. Toque em Iniciar de novo.' }, { status: 409 });

  const segment = await req.arrayBuffer();
  if (!segment.byteLength || segment.byteLength > 4_000_000) return NextResponse.json({ error: 'Segmento inválido.' }, { status: 400 });
  let playlist = '';
  try {
    playlist = atob(req.headers.get('x-hls-playlist') ?? '');
  } catch {
    /* sem playlist */
  }
  if (!playlist.startsWith('#EXTM3U') || playlist.length > 4000) return NextResponse.json({ error: 'Playlist inválida.' }, { status: 400 });

  const headers = { 'User-Agent': 'CursoVertice / Estudio / 1.0' };
  const seg = await fetch(base.url + file, { method: 'PUT', body: segment, headers: { ...headers, 'Content-Type': 'video/mp2t' } }).catch(() => null);
  if (!seg) return NextResponse.json({ error: 'Sem conexão com o YouTube.' }, { status: 502 });
  if (seg.status === 401 || seg.status === 403) return NextResponse.json({ error: 'O YouTube recusou a chave da transmissão.' }, { status: 401 });
  if (!seg.ok) return NextResponse.json({ error: `YouTube respondeu ${seg.status}.` }, { status: 502 });
  const pl = await fetch(base.url + 'live.m3u8', {
    method: 'PUT',
    body: playlist,
    headers: { ...headers, 'Content-Type': 'application/vnd.apple.mpegurl' },
  }).catch(() => null);
  if (!pl || (!pl.ok && pl.status !== 202)) return NextResponse.json({ error: 'Falha ao enviar a playlist.' }, { status: 502 });
  return NextResponse.json({ ok: true });
}
