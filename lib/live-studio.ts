import 'server-only';
import { randomBytes } from 'node:crypto';
import { sql } from '@/lib/db';

/**
 * Estúdio em vários aparelhos (celular, tablet, computador) para a mesma live.
 * - Um aparelho transmite por vez (lease). Os outros mostram a mesma cena e servem de controle remoto.
 * - Outro aparelho pode assumir no meio da live: continua a playlist do YouTube de onde parou
 *   (mesma transmissão, sem reiniciar) e o aparelho anterior para sozinho.
 * - A cena (câmera ou PDF, qual PDF e página, câmera no canto, microfone mudo) é a mesma em todos.
 */

/** Onde a playlist do YouTube parou: o próximo aparelho continua daqui. */
export interface StudioResume {
  /** número de sequência (HLS) do primeiro item da janela */
  msn: number;
  /** quantas descontinuidades já saíram da janela */
  discSeq: number;
  /** últimos itens da playlist */
  items: { name: string; dur: number; disc?: boolean }[];
  /** próximo número livre para o nome dos arquivos (segN.ts) */
  nextName: number;
  /** fim do último item no relógio da live (µs) */
  endUs: number;
  /** resolução da live (o próximo aparelho usa a mesma) */
  res?: '1080' | '720';
}

/** Cena compartilhada entre os aparelhos do estúdio. */
export interface StudioScene {
  scene?: 'camera' | 'pdf' | 'both' | 'screen';
  pdfId?: string;
  page?: number;
  pip?: boolean;
  muted?: boolean;
  res?: '1080' | '720';
  mirror?: boolean;
  pipBox?: { x: number; y: number; w: number };
}

interface Row {
  lease: string;
  device: string;
  label: string;
  lease_at: string | null;
  resume: StudioResume | null;
  state: StudioScene;
  rev: number;
}

/** Sem envio há mais que isso: o aparelho que transmitia caiu. */
export const HOLDER_STALE_MS = 10_000;

export const studioRow = (liveId: string) =>
  sql.one<Row>(`select lease, device, label, lease_at, resume, state, rev from live_studio where live_id = $1`, [liveId]);

/** Este aparelho passa a transmitir. Devolve o lease (vai em cada envio) e onde a live parou. */
export async function claimLease(liveId: string, device: string, label: string, fresh: boolean) {
  const lease = randomBytes(12).toString('hex');
  const row = await sql.one<{ resume: StudioResume | null }>(
    `insert into live_studio (live_id, lease, device, label, lease_at, resume) values ($1, $2, $3, $4, now(), null)
     on conflict (live_id) do update set lease = excluded.lease, device = excluded.device, label = excluded.label, lease_at = now(),
       resume = case when $5 then null else live_studio.resume end, updated_at = now()
     returning resume`,
    [liveId, lease, device.slice(0, 64), label.slice(0, 60), fresh],
  );
  return { lease, resume: fresh ? null : (row?.resume ?? null) };
}

/** Envio recebido: confere o lease. Devolve false se outro aparelho assumiu. */
export async function checkLease(liveId: string, lease: string) {
  const row = await sql.one<{ lease: string }>(`select lease from live_studio where live_id = $1`, [liveId]);
  // estúdio antigo (sem registro): aceita
  if (!row || !row.lease) return true;
  return row.lease === lease;
}

/** Guarda onde a playlist parou (a cada envio da playlist) e marca o aparelho como vivo. */
export async function saveResume(liveId: string, lease: string, resume: StudioResume | null) {
  if (resume)
    await sql.exec(`update live_studio set resume = $3, lease_at = now() where live_id = $1 and lease = $2`, [liveId, lease, JSON.stringify(resume)]);
  else await sql.exec(`update live_studio set lease_at = now() where live_id = $1 and lease = $2`, [liveId, lease]);
}

/** Muda a cena (vale para todos os aparelhos). */
export async function patchScene(liveId: string, patch: StudioScene) {
  const row = await sql.one<{ rev: number; state: StudioScene }>(
    `insert into live_studio (live_id, state, rev) values ($1, $2, 1)
     on conflict (live_id) do update set state = live_studio.state || excluded.state, rev = live_studio.rev + 1, updated_at = now()
     returning rev, state`,
    [liveId, JSON.stringify(patch)],
  );
  return row ?? { rev: 0, state: {} };
}

export const endStudio = (liveId: string) => sql.exec(`update live_studio set lease = '', device = '', label = '', resume = null where live_id = $1`, [liveId]);
