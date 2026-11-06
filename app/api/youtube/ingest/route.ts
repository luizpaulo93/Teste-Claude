import { NextResponse, type NextRequest } from 'next/server';
import { getViewer } from '@/lib/session';
import { checkLease, saveResume, type StudioResume } from '@/lib/live-studio';
import { getIngest } from '@/lib/youtube';

export const maxDuration = 20;
// Perto do professor (Brasil) e do YouTube: o segmento não atravessa até os EUA e volta
export const preferredRegion = 'gru1';

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
  if (!/^[\w-]{1,64}$/.test(live) || (file && !/^seg\d{1,7}\.ts$/.test(file))) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });

  let base = cache.get(live);
  if (!base || Date.now() - base.at > 60_000) {
    base = { url: await getIngest(live), at: Date.now() };
    cache.set(live, base);
  }
  if (!base.url) return NextResponse.json({ error: 'Transmissão não preparada. Toque em Iniciar de novo.' }, { status: 409 });
  // outro aparelho assumiu a transmissão: este para (sem mexer na live)
  const lease = req.headers.get('x-studio-lease') ?? '';
  if (!(await checkLease(live, lease)))
    return NextResponse.json({ error: 'A transmissão passou para outro aparelho.', code: 'handoff' }, { status: 409 });

  const segment = await req.arrayBuffer();
  // sem arquivo = só atualiza a playlist (segmentos chegaram fora de ordem)
  if ((file && !segment.byteLength) || segment.byteLength > 4_400_000) return NextResponse.json({ error: 'Segmento inválido.' }, { status: 400 });
  let playlist = '';
  try {
    playlist = atob(req.headers.get('x-hls-playlist') ?? '');
  } catch {
    /* sem playlist */
  }
  // segmento fora de ordem vem sem playlist (ela é atualizada quando os anteriores chegarem)
  if ((playlist || !file) && (!playlist.startsWith('#EXTM3U') || playlist.length > 4000))
    return NextResponse.json({ error: 'Playlist inválida.' }, { status: 400 });

  const headers = { 'User-Agent': 'CursoVertice / Estudio / 1.0' };
  const seg = !file
    ? new Response(null)
    : await fetch(base.url + file, { method: 'PUT', body: segment, headers: { ...headers, 'Content-Type': 'video/mp2t' } }).catch(() => null);
  if (!seg) return NextResponse.json({ error: 'Sem conexão com o YouTube.' }, { status: 502 });
  if (seg.status === 401 || seg.status === 403) return NextResponse.json({ error: 'O YouTube recusou a chave da transmissão.' }, { status: 401 });
  if (!seg.ok) return NextResponse.json({ error: `YouTube respondeu ${seg.status}.` }, { status: 502 });
  if (!playlist) {
    if (lease) await saveResume(live, lease, null).catch(() => {});
    return NextResponse.json({ ok: true });
  }
  const pl = await fetch(base.url + 'live.m3u8', {
    method: 'PUT',
    body: playlist,
    headers: { ...headers, 'Content-Type': 'application/vnd.apple.mpegurl' },
  }).catch(() => null);
  if (!pl || (!pl.ok && pl.status !== 202)) return NextResponse.json({ error: 'Falha ao enviar a playlist.' }, { status: 502 });
  // onde a playlist parou: se outro aparelho assumir, continua daqui (mesma live)
  if (lease) {
    let resume: StudioResume | null = null;
    try {
      const raw = req.headers.get('x-studio-resume');
      if (raw && raw.length < 4000) resume = JSON.parse(atob(raw)) as StudioResume;
    } catch {
      /* sem estado */
    }
    await saveResume(live, lease, resume).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
