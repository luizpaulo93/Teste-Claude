/**
 * Empacotador MPEG-TS (o mesmo formato que o OBS manda para o YouTube por HLS).
 * Recebe H.264 (Annex B) e AAC (ADTS) já codificados e gera segmentos .ts
 * independentes (cada um começa com PAT/PMT e um quadro-chave).
 */

const PACKET = 188;
const PID_PMT = 0x1000;
const PID_VIDEO = 0x100;
const PID_AUDIO = 0x101;
/** Atraso inicial para o relógio (PCR) ficar sempre antes do PTS */
const BASE = 90000; // 1 s em 90 kHz

export interface VideoSample {
  data: Uint8Array; // Annex B
  pts: number; // microssegundos
  key: boolean;
}
export interface AudioSample {
  data: Uint8Array; // ADTS
  pts: number; // microssegundos
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i << 24;
    for (let j = 0; j < 8; j++) c = c & 0x80000000 ? (c << 1) ^ 0x04c11db7 : c << 1;
    t[i] = c >>> 0;
  }
  return t;
})();
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const b of bytes) crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ b) & 0xff]) >>> 0;
  return crc >>> 0;
}

export class TsMuxer {
  private cc = new Map<number, number>();

  private nextCc(pid: number) {
    const v = this.cc.get(pid) ?? 0;
    this.cc.set(pid, (v + 1) & 0x0f);
    return v;
  }

  /** Um segmento completo: PAT + PMT + vídeo/áudio intercalados por tempo. */
  segment(video: VideoSample[], audio: AudioSample[]): Uint8Array {
    const out: Uint8Array[] = [this.psi(0, this.patSection()), this.psi(PID_PMT, this.pmtSection())];
    let a = 0;
    for (const v of video) {
      while (a < audio.length && audio[a].pts <= v.pts) out.push(...this.audioPes(audio[a++]));
      out.push(...this.videoPes(v));
    }
    while (a < audio.length) out.push(...this.audioPes(audio[a++]));
    const total = out.reduce((n, p) => n + p.length, 0);
    const buf = new Uint8Array(total);
    let o = 0;
    for (const p of out) {
      buf.set(p, o);
      o += p.length;
    }
    return buf;
  }

  // ---------- tabelas
  private patSection() {
    const s = [0x00, 0xb0, 0x0d, 0x00, 0x01, 0xc1, 0x00, 0x00, 0x00, 0x01, 0xe0 | (PID_PMT >> 8), PID_PMT & 0xff];
    return withCrc(s);
  }
  private pmtSection() {
    const streams = [0x1b, 0xe0 | (PID_VIDEO >> 8), PID_VIDEO & 0xff, 0xf0, 0x00, 0x0f, 0xe0 | (PID_AUDIO >> 8), PID_AUDIO & 0xff, 0xf0, 0x00];
    const len = 9 + streams.length + 4;
    const s = [0x02, 0xb0 | (len >> 8), len & 0xff, 0x00, 0x01, 0xc1, 0x00, 0x00, 0xe0 | (PID_VIDEO >> 8), PID_VIDEO & 0xff, 0xf0, 0x00, ...streams];
    return withCrc(s);
  }
  private psi(pid: number, section: Uint8Array) {
    const p = new Uint8Array(PACKET).fill(0xff);
    p[0] = 0x47;
    p[1] = 0x40 | (pid >> 8);
    p[2] = pid & 0xff;
    p[3] = 0x10 | this.nextCc(pid);
    p[4] = 0x00; // pointer field
    p.set(section, 5);
    return p;
  }

  // ---------- PES
  private videoPes(v: VideoSample) {
    const pts = BASE + Math.round(v.pts * 0.09);
    // AUD (delimitador de quadro) antes de cada quadro, como pede o padrão
    const aud = new Uint8Array([0, 0, 0, 1, 0x09, 0xf0]);
    const header = pesHeader(0xe0, pts, 0);
    const payload = concat([header, aud, v.data]);
    return this.packetize(PID_VIDEO, payload, Math.max(0, pts - 9000), v.key);
  }
  private audioPes(s: AudioSample) {
    const pts = BASE + Math.round(s.pts * 0.09);
    const header = pesHeader(0xc0, pts, s.data.length);
    return this.packetize(PID_AUDIO, concat([header, s.data]), null, false);
  }

  private packetize(pid: number, payload: Uint8Array, pcr: number | null, rai: boolean) {
    const packets: Uint8Array[] = [];
    let off = 0;
    let first = true;
    while (off < payload.length) {
      const p = new Uint8Array(PACKET).fill(0xff);
      p[0] = 0x47;
      p[1] = (first ? 0x40 : 0) | (pid >> 8);
      p[2] = pid & 0xff;
      // Campo de adaptação: PCR / início aleatório no 1º pacote
      const fields: number[] = [];
      if (first && (pcr !== null || rai)) {
        fields.push((rai ? 0x40 : 0) | (pcr !== null ? 0x10 : 0));
        if (pcr !== null) fields.push(Math.floor(pcr / 2 ** 25) & 0xff, (pcr >>> 17) & 0xff, (pcr >>> 9) & 0xff, (pcr >>> 1) & 0xff, ((pcr & 1) << 7) | 0x7e, 0x00);
      }
      const remaining = payload.length - off;
      let i = 4;
      let take: number;
      if (!fields.length && remaining >= 184) {
        p[3] = 0x10 | this.nextCc(pid);
        take = 184;
      } else {
        // com campo de adaptação (e enchimento no último pacote)
        p[3] = 0x30 | this.nextCc(pid);
        if (!fields.length) {
          const len = 184 - remaining - 1; // bytes do campo depois do byte de tamanho
          p[i++] = len;
          if (len > 0) {
            p[i++] = 0x00; // flags
            i += len - 1; // 0xff já preenchido
          }
          take = remaining;
        } else {
          const room = 183 - fields.length;
          take = Math.min(room, remaining);
          const stuffing = room - take;
          p[i++] = fields.length + stuffing;
          for (const b of fields) p[i++] = b;
          i += stuffing;
        }
      }
      p.set(payload.subarray(off, off + take), i);
      off += take;
      packets.push(p);
      first = false;
    }
    return packets;
  }
}

function pesHeader(streamId: number, pts: number, payloadLen: number) {
  const h = new Uint8Array(14);
  h[0] = 0;
  h[1] = 0;
  h[2] = 1;
  h[3] = streamId;
  const len = payloadLen ? payloadLen + 8 : 0; // vídeo: 0 = tamanho livre
  h[4] = len > 0xffff ? 0 : len >> 8;
  h[5] = len > 0xffff ? 0 : len & 0xff;
  h[6] = 0x80;
  h[7] = 0x80; // só PTS
  h[8] = 5;
  h[9] = 0x21 | ((Math.floor(pts / 2 ** 30) & 0x07) << 1);
  h[10] = (pts >>> 22) & 0xff;
  h[11] = (((pts >>> 15) & 0x7f) << 1) | 1;
  h[12] = (pts >>> 7) & 0xff;
  h[13] = ((pts & 0x7f) << 1) | 1;
  return h;
}

function withCrc(section: number[]) {
  const s = new Uint8Array(section.length + 4);
  s.set(section);
  const c = crc32(s.subarray(0, section.length));
  s[section.length] = c >>> 24;
  s[section.length + 1] = (c >>> 16) & 0xff;
  s[section.length + 2] = (c >>> 8) & 0xff;
  s[section.length + 3] = c & 0xff;
  return s;
}

function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Cabeçalho ADTS para um quadro AAC cru (quando o navegador não entrega ADTS pronto). */
export function adts(frame: Uint8Array, sampleRate: number, channels: number) {
  const rates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
  const sf = Math.max(0, rates.indexOf(sampleRate));
  const len = frame.length + 7;
  const h = new Uint8Array(7);
  h[0] = 0xff;
  h[1] = 0xf1;
  h[2] = (1 << 6) | (sf << 2) | ((channels >> 2) & 1); // perfil LC
  h[3] = ((channels & 3) << 6) | ((len >> 11) & 3);
  h[4] = (len >> 3) & 0xff;
  h[5] = ((len & 7) << 5) | 0x1f;
  h[6] = 0xfc;
  return concat([h, frame]);
}
