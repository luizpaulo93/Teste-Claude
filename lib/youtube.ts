import 'server-only';
import { sql } from '@/lib/db';

/**
 * Integração com o YouTube (só servidor).
 * - Conta conectada (OAuth do Google): o app cria a live no canal sozinho.
 * - Sem conta conectada: usa a chave HLS copiada do YouTube Studio.
 */

// Endereços do Google (podem ser trocados só para testes locais)
const TOKEN_URL = process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const API = process.env.YOUTUBE_API_BASE || 'https://www.googleapis.com/youtube/v3';
export const YT_SCOPE = 'https://www.googleapis.com/auth/youtube';

export interface YoutubeAccount {
  refresh_token?: string;
  access_token?: string;
  expires_at?: number;
  channel_id?: string;
  channel_title?: string;
  /** Chave HLS do YouTube Studio (modo sem conta conectada) */
  stream_key?: string;
}

export const oauthConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export async function getAccount(): Promise<YoutubeAccount> {
  const row = await sql.one<{ data: YoutubeAccount }>(`select data from integrations where id = 'youtube'`);
  return row?.data ?? {};
}

export async function saveAccount(patch: Partial<YoutubeAccount>) {
  const cur = await getAccount();
  const next = { ...cur, ...patch };
  for (const k of Object.keys(next) as (keyof YoutubeAccount)[]) if (next[k] === undefined || next[k] === '') delete next[k];
  await sql.exec(
    `insert into integrations (id, data) values ('youtube', $1) on conflict (id) do update set data = excluded.data, updated_at = now()`,
    [JSON.stringify(next)],
  );
  return next;
}

/** Aceita a chave sozinha ou a URL HLS completa copiada do YouTube Studio. */
// Endereço HLS do YouTube (pode ser trocado só para testes locais)
const HLS_BASE = process.env.YOUTUBE_HLS_BASE || 'https://a.upload.youtube.com/http_upload_hls';

export function ingestFromKey(keyOrUrl: string) {
  const v = keyOrUrl.trim();
  if (/^https:\/\/[ab]\.upload\.youtube\.com\/http_upload_hls\?/.test(v)) {
    const u = new URL(v);
    const cid = u.searchParams.get('cid');
    return cid ? `${HLS_BASE}?cid=${encodeURIComponent(cid)}&copy=0&file=` : '';
  }
  if (/^[\w-]{8,80}$/.test(v)) return `${HLS_BASE}?cid=${encodeURIComponent(v)}&copy=0&file=`;
  return '';
}

export async function exchangeCode(code: string, redirectUri: string) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const j = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !j.access_token) throw new Error(j.error_description || 'Não foi possível conectar ao YouTube.');
  return j;
}

async function accessToken(): Promise<string> {
  const acc = await getAccount();
  if (!acc.refresh_token) throw new Error('Conecte a conta do YouTube primeiro.');
  if (acc.access_token && acc.expires_at && acc.expires_at > Date.now() + 60_000) return acc.access_token;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: acc.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const j = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!res.ok || !j.access_token) throw new Error('A conexão com o YouTube expirou. Conecte a conta de novo.');
  await saveAccount({ access_token: j.access_token, expires_at: Date.now() + (j.expires_in ?? 3600) * 1000 });
  return j.access_token;
}

async function yt<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const token = init.token ?? (await accessToken());
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const j = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; errors?: { reason?: string }[] } };
  if (!res.ok) {
    const reason = j.error?.errors?.[0]?.reason;
    if (reason === 'liveStreamingNotEnabled') throw new Error('Ative a transmissão ao vivo no seu canal (YouTube Studio → Transmitir). A liberação pode levar até 24 h.');
    throw new Error(j.error?.message || 'O YouTube recusou o pedido.');
  }
  return j;
}

export async function channelOf(token: string) {
  const j = await yt<{ items?: { id: string; snippet: { title: string } }[] }>('/channels?part=snippet&mine=true', { token });
  const ch = j.items?.[0];
  return { channel_id: ch?.id ?? '', channel_title: ch?.snippet.title ?? 'Seu canal' };
}

/** Cria a live (não listada) no canal e devolve o ID do vídeo e o endereço HLS. */
export async function createBroadcast(title: string, description: string) {
  const stream = await yt<{ id: string; cdn: { ingestionInfo: { ingestionAddress: string; streamName: string } } }>('/liveStreams?part=snippet,cdn,contentDetails', {
    method: 'POST',
    body: JSON.stringify({
      snippet: { title: title.slice(0, 100) },
      cdn: { ingestionType: 'hls', resolution: 'variable', frameRate: 'variable' },
      contentDetails: { isReusable: false },
    }),
  });
  const broadcast = await yt<{ id: string }>('/liveBroadcasts?part=snippet,status,contentDetails', {
    method: 'POST',
    body: JSON.stringify({
      snippet: { title: title.slice(0, 100), description: description.slice(0, 4000), scheduledStartTime: new Date().toISOString() },
      status: { privacyStatus: 'unlisted', selfDeclaredMadeForKids: false },
      contentDetails: { enableAutoStart: true, enableAutoStop: true, enableDvr: true, latencyPreference: 'low', monitorStream: { enableMonitorStream: false } },
    }),
  });
  await yt(`/liveBroadcasts/bind?id=${broadcast.id}&part=id,contentDetails&streamId=${stream.id}`, { method: 'POST' });
  const info = stream.cdn.ingestionInfo;
  // Para HLS o endereço já vem com cid=...&file=
  const ingest = info.ingestionAddress.includes('cid=') ? info.ingestionAddress : ingestFromKey(info.streamName);
  return { videoId: broadcast.id, ingest };
}

export async function endBroadcast(videoId: string) {
  await yt(`/liveBroadcasts/transition?broadcastStatus=complete&id=${videoId}&part=status`, { method: 'POST' }).catch(() => {});
}

// ---------- endereço de envio de cada live (guardado só no servidor)
export async function setIngest(liveId: string, ingest: string) {
  await sql.exec(
    `insert into integrations (id, data) values ($1, $2) on conflict (id) do update set data = excluded.data, updated_at = now()`,
    [`ingest:${liveId}`, JSON.stringify({ ingest })],
  );
}
export async function getIngest(liveId: string) {
  const row = await sql.one<{ data: { ingest?: string } }>(`select data from integrations where id = $1`, [`ingest:${liveId}`]);
  return row?.data.ingest ?? '';
}
