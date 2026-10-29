/**
 * Estúdio de transmissão no navegador, no estilo do OBS:
 * câmera/tela + microfone → H.264 + AAC (WebCodecs) → segmentos MPEG-TS de ~2 s → HLS para o YouTube.
 * O envio passa pelo nosso servidor (/api/youtube/ingest), que guarda a chave do YouTube.
 */
import { adts, TsMuxer, type AudioSample, type VideoSample } from './ts-muxer';

export interface BroadcastOptions {
  liveId: string;
  stream: MediaStream; // vídeo + áudio já escolhidos
  width: number;
  height: number;
  fps: number;
  videoBitrate: number;
  onStatus?: (s: BroadcastStatus) => void;
  /** Para testes: destino alternativo */
  endpoint?: string;
}

export interface BroadcastStatus {
  state: 'starting' | 'live' | 'reconnecting' | 'stopped' | 'error';
  seconds: number;
  sent: number; // segmentos enviados
  queue: number;
  kbps: number;
  message?: string;
}

const SEGMENT_US = 2_000_000;

// API do Chrome/Edge que entrega os quadros da câmera e do microfone (ainda fora dos tipos padrão)
declare const MediaStreamTrackProcessor: {
  new (init: { track: MediaStreamTrack }): { readable: ReadableStream<VideoFrame & AudioData> };
};

/** O navegador consegue transmitir? (precisa de WebCodecs com H.264 e AAC) */
export async function checkSupport(): Promise<{ ok: boolean; reason?: string }> {
  if (typeof VideoEncoder === 'undefined' || typeof AudioEncoder === 'undefined' || typeof MediaStreamTrackProcessor === 'undefined')
    return { ok: false, reason: 'Use o Google Chrome ou o Microsoft Edge atualizado (computador ou Android).' };
  const v = await VideoEncoder.isConfigSupported({ codec: 'avc1.42E01F', width: 1280, height: 720, bitrate: 2_500_000, framerate: 30 }).catch(() => null);
  if (!v?.supported) return { ok: false, reason: 'Este navegador não codifica vídeo H.264.' };
  const a = await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 128000 }).catch(() => null);
  if (!a?.supported) return { ok: false, reason: 'Este navegador não codifica áudio AAC. Use o Chrome ou Edge no Windows, Mac ou Android.' };
  return { ok: true };
}

export class Broadcaster {
  private o: BroadcastOptions;
  private muxer = new TsMuxer();
  private venc?: VideoEncoder;
  private aenc?: AudioEncoder;
  private canvas: OffscreenCanvas;
  private ctx: OffscreenCanvasRenderingContext2D;
  private running = false;
  private t0 = 0; // performance.now() no início
  private video: VideoSample[] = [];
  private audio: AudioSample[] = [];
  private segStart = -1;
  private lastKeyAt = -Infinity;
  private seq = 0;
  private playlist: { name: string; dur: number }[] = [];
  private uploads: { name: string; data: Uint8Array; dur: number }[] = [];
  private uploading = false;
  private sentBytes = 0;
  private sent = 0;
  private failures = 0;
  private audioCfg?: { sampleRate: number; channels: number; adts: boolean };
  private readers: ReadableStreamDefaultReader[] = [];
  private status: BroadcastStatus = { state: 'starting', seconds: 0, sent: 0, queue: 0, kbps: 0 };
  private tick?: number;
  private audioFirstTs = -1;
  private audioOffsetUs = 0;

  constructor(o: BroadcastOptions) {
    this.o = o;
    this.canvas = new OffscreenCanvas(o.width, o.height);
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
  }

  async start() {
    this.running = true;
    this.t0 = performance.now();
    this.venc = new VideoEncoder({
      output: (chunk) => this.onVideo(chunk),
      error: (e) => this.fail(`Erro no vídeo: ${e.message}`),
    });
    this.venc.configure({
      codec: this.o.height > 720 ? 'avc1.640028' : 'avc1.4D401F',
      width: this.o.width,
      height: this.o.height,
      bitrate: this.o.videoBitrate,
      framerate: this.o.fps,
      latencyMode: 'realtime',
      avc: { format: 'annexb' },
    });
    const vt = this.o.stream.getVideoTracks()[0];
    const at = this.o.stream.getAudioTracks()[0];
    if (vt) this.setVideoTrack(vt);
    if (at) void this.pumpAudio(at);
    this.tick = window.setInterval(() => {
      this.flush();
      this.emit();
    }, 200);
    this.emit();
  }

  async stop() {
    if (!this.running) return;
    this.running = false;
    for (const r of this.readers) r.cancel().catch(() => {});
    if (this.tick) window.clearInterval(this.tick);
    try {
      await this.venc?.flush();
      await this.aenc?.flush();
    } catch {
      /* encerrando */
    }
    this.ending = true;
    this.cut(Infinity, false);
    // Fim da transmissão: playlist com ENDLIST
    await this.drain(true);
    this.venc?.close();
    this.aenc?.close();
    this.status = { ...this.status, state: 'stopped' };
    this.emit();
  }

  /** Troca a câmera/tela no meio da transmissão (o vídeo continua no mesmo tamanho). */
  setVideoTrack(track: MediaStreamTrack) {
    this.videoReader?.cancel().catch(() => {});
    if (this.running) void this.pumpVideo(track);
  }
  private videoReader?: ReadableStreamDefaultReader<VideoFrame>;

  // ---------------- captura
  private async pumpVideo(track: MediaStreamTrack) {
    const reader = (new MediaStreamTrackProcessor({ track }).readable as unknown as ReadableStream<VideoFrame>).getReader();
    this.videoReader = reader;
    this.readers.push(reader);
    const frameUs = 1e6 / this.o.fps;
    let next = 0;
    while (this.running && this.videoReader === reader) {
      const { value: frame, done } = await reader.read().catch(() => ({ value: undefined, done: true }));
      if (done || !frame) break;
      const ts = Math.round((performance.now() - this.t0) * 1000);
      // limita o fps e descarta quadros se o codificador estiver atrasado
      if (ts < next || !this.venc || this.venc.encodeQueueSize > 3) {
        frame.close();
        continue;
      }
      next = ts + frameUs * 0.9;
      // desenha centralizado num quadro fixo (troca de câmera/tela não muda o tamanho do vídeo)
      const fw = frame.displayWidth;
      const fh = frame.displayHeight;
      const scale = Math.min(this.o.width / fw, this.o.height / fh);
      const dw = Math.round(fw * scale);
      const dh = Math.round(fh * scale);
      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(0, 0, this.o.width, this.o.height);
      this.ctx.drawImage(frame, (this.o.width - dw) / 2, (this.o.height - dh) / 2, dw, dh);
      frame.close();
      const out = new VideoFrame(this.canvas, { timestamp: ts });
      const key = ts - this.lastKeyAt >= SEGMENT_US;
      if (key) this.lastKeyAt = ts;
      this.venc.encode(out, { keyFrame: key });
      out.close();
    }
  }

  private async pumpAudio(track: MediaStreamTrack) {
    const reader = (new MediaStreamTrackProcessor({ track }).readable as unknown as ReadableStream<AudioData>).getReader();
    this.readers.push(reader);
    while (this.running) {
      const { value: data, done } = await reader.read().catch(() => ({ value: undefined, done: true }));
      if (done || !data) break;
      if (!this.aenc) await this.setupAudio(data.sampleRate, Math.min(2, data.numberOfChannels));
      if (this.audioFirstTs < 0) {
        this.audioFirstTs = data.timestamp;
        this.audioOffsetUs = Math.round((performance.now() - this.t0) * 1000);
      }
      try {
        this.aenc!.encode(data);
      } catch {
        /* quadro inválido */
      }
      data.close();
    }
  }

  private async setupAudio(sampleRate: number, channels: number) {
    const base = { codec: 'mp4a.40.2', sampleRate, numberOfChannels: channels, bitrate: 128000 };
    // Pede ADTS pronto; se não der, montamos o cabeçalho aqui
    const withAdts = { ...base, aac: { format: 'adts' as const } };
    const useAdts = Boolean((await AudioEncoder.isConfigSupported(withAdts).catch(() => null))?.supported);
    this.audioCfg = { sampleRate, channels, adts: useAdts };
    this.aenc = new AudioEncoder({
      output: (chunk) => this.onAudio(chunk),
      error: (e) => this.fail(`Erro no áudio: ${e.message}`),
    });
    this.aenc.configure(useAdts ? withAdts : base);
  }

  // ---------------- saída dos codificadores
  private onVideo(chunk: EncodedVideoChunk) {
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    const key = chunk.type === 'key';
    if (this.segStart < 0) {
      if (!key) return; // cada segmento começa num quadro-chave
      this.segStart = chunk.timestamp;
    } else if (key && chunk.timestamp - this.segStart >= SEGMENT_US * 0.9) {
      this.pendingCut = chunk.timestamp;
    }
    this.video.push({ data, pts: chunk.timestamp, key });
  }
  private pendingCut = -1;
  private ending = false;

  private onAudio(chunk: EncodedAudioChunk) {
    let data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    if (!this.audioCfg?.adts) data = adts(data, this.audioCfg!.sampleRate, this.audioCfg!.channels);
    const pts = chunk.timestamp - this.audioFirstTs + this.audioOffsetUs;
    if (pts >= 0) this.audio.push({ data, pts });
  }

  /** Fecha o segmento quando já chegou o áudio até o próximo quadro-chave (ou depois de esperar um pouco). */
  private flush() {
    if (this.pendingCut < 0) return;
    const lastAudio = this.audio.length ? this.audio[this.audio.length - 1].pts : -1;
    const waited = (performance.now() - this.t0) * 1000 - this.pendingCut;
    if (lastAudio >= this.pendingCut || waited > 600_000 || !this.o.stream.getAudioTracks().length) {
      this.cut(this.pendingCut);
      this.pendingCut = -1;
    }
  }

  private cut(at: number, send = true) {
    const v = this.video.filter((s) => s.pts < at);
    if (!v.length) return;
    this.video = this.video.filter((s) => s.pts >= at);
    const a = this.audio.filter((s) => s.pts < at);
    this.audio = this.audio.filter((s) => s.pts >= at);
    const end = at === Infinity ? v[v.length - 1].pts + 1e6 / this.o.fps : at;
    const dur = Math.max(0.1, (end - v[0].pts) / 1e6);
    const data = this.muxer.segment(v, a);
    this.segStart = at === Infinity ? -1 : at;
    const name = `seg${this.seq++}.ts`;
    this.uploads.push({ name, data, dur });
    // Rede lenta: mantém no máximo 5 segmentos na fila (descarta os mais antigos)
    while (this.uploads.length > 5) this.uploads.shift();
    if (send) void this.drain(false);
  }

  private async drain(end: boolean) {
    if (this.uploading) {
      if (!end) return;
      while (this.uploading) await new Promise((r) => setTimeout(r, 100));
    }
    this.uploading = true;
    try {
      while (this.uploads.length) {
        const seg = this.uploads[0];
        const list = [...this.playlist, { name: seg.name, dur: seg.dur }].slice(-5);
        const isLast = (end || this.ending) && this.uploads.length === 1;
        const ok = await this.send(seg, playlistText(list, this.seqOf(list[0].name), isLast));
        if (ok) {
          this.uploads.shift();
          this.playlist.push({ name: seg.name, dur: seg.dur });
          this.playlist = this.playlist.slice(-5);
          this.sent++;
          this.sentBytes += seg.data.length;
          this.failures = 0;
          if (this.status.state !== 'live' && this.running) this.status.state = 'live';
        } else {
          this.failures++;
          this.status.state = 'reconnecting';
          this.emit();
          if (!this.running && this.failures > 3) break;
          await new Promise((r) => setTimeout(r, Math.min(4000, 500 * this.failures)));
        }
      }
    } finally {
      this.uploading = false;
    }
  }

  private seqOf(name: string) {
    return Number(name.replace(/\D/g, '')) || 0;
  }

  private async send(seg: { name: string; data: Uint8Array }, playlist: string) {
    try {
      const url = `${this.o.endpoint ?? '/api/youtube/ingest'}?live=${encodeURIComponent(this.o.liveId)}&file=${seg.name}`;
      const res = await fetch(url, {
        method: 'POST',
        body: seg.data as BodyInit,
        headers: { 'Content-Type': 'video/mp2t', 'X-Hls-Playlist': btoa(playlist) },
      });
      if (res.status === 401 || res.status === 403 || res.status === 409) {
        const msg = (await res.json().catch(() => ({}))).error;
        this.fail(msg || 'O YouTube recusou a transmissão. Confira a chave da transmissão.');
        return true; // não insiste
      }
      return res.ok;
    } catch {
      return false;
    }
  }

  private fail(message: string) {
    this.status = { ...this.status, state: 'error', message };
    this.emit();
    this.running = false;
    for (const r of this.readers) r.cancel().catch(() => {});
    if (this.tick) window.clearInterval(this.tick);
  }

  private emit() {
    const seconds = Math.round((performance.now() - this.t0) / 1000);
    this.status = {
      ...this.status,
      seconds,
      sent: this.sent,
      queue: this.uploads.length,
      kbps: seconds ? Math.round((this.sentBytes * 8) / 1000 / seconds) : 0,
    };
    this.o.onStatus?.({ ...this.status });
  }
}

function playlistText(list: { name: string; dur: number }[], firstSeq: number, end: boolean) {
  const target = Math.max(2, Math.ceil(Math.max(...list.map((s) => s.dur))));
  let t = `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:${target}\n#EXT-X-MEDIA-SEQUENCE:${firstSeq}\n`;
  for (const s of list) t += `#EXTINF:${s.dur.toFixed(3)},\n${s.name}\n`;
  if (end) t += '#EXT-X-ENDLIST\n';
  return t;
}
