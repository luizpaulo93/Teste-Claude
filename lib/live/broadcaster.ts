/**
 * Estúdio de transmissão no navegador, no estilo do OBS:
 * câmera/tela + microfone → H.264 + AAC (WebCodecs) → segmentos MPEG-TS de ~2 s → HLS para o YouTube.
 * O envio passa pelo nosso servidor (/api/youtube/ingest), que guarda a chave do YouTube.
 */
import { workerTicker } from './ticker';
import { adts, TsMuxer, type AudioSample, type VideoSample } from './ts-muxer';

export interface BroadcastOptions {
  liveId: string;
  stream: MediaStream; // vídeo + áudio já escolhidos
  width: number;
  height: number;
  fps: number;
  videoBitrate: number;
  /** Taxa variável: começa no máximo e se ajusta à conexão (sem isso, fica fixa em videoBitrate) */
  minBitrate?: number;
  maxBitrate?: number;
  onStatus?: (s: BroadcastStatus) => void;
  /** Para testes: destino alternativo */
  endpoint?: string;
  /** Safari (sem MediaStreamTrackProcessor): o som é lido direto do mixer por um AudioWorklet */
  audioSource?: { ctx: AudioContext; node: AudioNode };
}

export interface BroadcastStatus {
  state: 'starting' | 'live' | 'reconnecting' | 'stopped' | 'error';
  seconds: number;
  sent: number; // segmentos enviados
  queue: number;
  kbps: number;
  /** taxa de vídeo atual (kbps) */
  rate?: number;
  /** quadros por segundo realmente codificados */
  fps?: number;
  /** % de quadros perdidos porque o aparelho não deu conta (últimos segundos) */
  lost?: number;
  message?: string;
}

const SEGMENT_US = 2_000_000;

// API do Chrome/Edge que entrega os quadros da câmera e do microfone (ainda fora dos tipos padrão)
declare const MediaStreamTrackProcessor: {
  new (init: { track: MediaStreamTrack }): { readable: ReadableStream<VideoFrame & AudioData> };
};

/** O navegador consegue transmitir? (precisa de WebCodecs com H.264 e AAC) */
export async function checkSupport(): Promise<{ ok: boolean; reason?: string }> {
  if (typeof VideoEncoder === 'undefined' || typeof AudioEncoder === 'undefined' || typeof AudioWorkletNode === 'undefined')
    return { ok: false, reason: 'Atualize o navegador (Chrome, Edge ou Safari recentes) para transmitir.' };
  const v = await VideoEncoder.isConfigSupported({ codec: 'avc1.42E01F', width: 1280, height: 720, bitrate: 2_500_000, framerate: 30 }).catch(() => null);
  if (!v?.supported) return { ok: false, reason: 'Este navegador não codifica vídeo H.264.' };
  const a = await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 128000 }).catch(() => null);
  if (!a?.supported) return { ok: false, reason: 'Este navegador não codifica áudio AAC. Atualize o sistema ou use o Chrome/Edge no computador.' };
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
  private uploads: { n: number; name: string; data: Uint8Array; dur: number }[] = [];
  private sentBytes = 0;
  private sent = 0;
  private failures = 0;
  private audioCfg?: { sampleRate: number; channels: number; adts: boolean };
  private readers: ReadableStreamDefaultReader[] = [];
  private status: BroadcastStatus = { state: 'starting', seconds: 0, sent: 0, queue: 0, kbps: 0 };
  private stopTick?: () => void;
  private nextFrame = 0;
  private audioFirstTs = -1;
  private audioOffsetUs = 0;
  private cfg?: VideoEncoderConfig;
  private rate = 0;
  private pendingRate = 0;
  private min = 0;
  private max = 0;

  constructor(o: BroadcastOptions) {
    this.o = o;
    this.rate = o.videoBitrate;
    this.min = o.minBitrate ?? o.videoBitrate;
    this.max = o.maxBitrate ?? o.videoBitrate;
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
    this.cfg = await this.bestVideoConfig();
    this.venc.configure(this.cfg);
    this.status.rate = Math.round(this.rate / 1000);
    const vt = this.o.stream.getVideoTracks()[0];
    const at = this.o.stream.getAudioTracks()[0];
    if (vt) this.setVideoTrack(vt);
    if (typeof MediaStreamTrackProcessor !== 'undefined' && at) void this.pumpAudio(at);
    else if (this.o.audioSource) await this.captureAudio(this.o.audioSource);
    // Relógio de Worker: não para quando a aba do estúdio fica em segundo plano
    let n = 0;
    this.stopTick = workerTicker(200, () => {
      this.flush();
      if (++n % 5 === 0) this.emit();
    });
    this.emit();
  }

  /**
   * Configuração recomendada pelo YouTube/OBS: H.264 perfil High (nível 3.1 no 720p, 4.1 no 1080p),
   * taxa constante (CBR), 30 fps e quadro-chave a cada 2 s (feito em pushFrame). Chip de vídeo do aparelho
   * em tempo real quando disponível; se o aparelho não aceitar, vai baixando até uma que aceite.
   */
  private async bestVideoConfig(): Promise<VideoEncoderConfig> {
    const big = this.o.height > 720;
    const base = { width: this.o.width, height: this.o.height, bitrate: this.o.videoBitrate, framerate: this.o.fps, avc: { format: 'annexb' as const } };
    const codecs = big ? ['avc1.640029', 'avc1.640028', 'avc1.4D4029', 'avc1.42E029'] : ['avc1.64001F', 'avc1.4D401F', 'avc1.42E01F'];
    // Tempo real primeiro: o codificador nunca fica para trás (é o que evita quadros perdidos no 1080p)
    const extras = [
      { bitrateMode: 'constant' as const, latencyMode: 'realtime' as const, hardwareAcceleration: 'prefer-hardware' as const },
      { bitrateMode: 'constant' as const, latencyMode: 'realtime' as const },
      { latencyMode: 'realtime' as const, hardwareAcceleration: 'prefer-hardware' as const },
      { latencyMode: 'realtime' as const },
      { latencyMode: 'quality' as const },
    ];
    for (const extra of extras)
      for (const codec of codecs) {
        const cfg = { ...base, codec, ...extra };
        const r = await VideoEncoder.isConfigSupported(cfg).catch(() => null);
        if (r?.supported) return cfg;
      }
    return { ...base, codec: big ? 'avc1.640028' : 'avc1.4D401F', latencyMode: 'realtime' };
  }

  /** Relógio da live em µs. No Safari usa o relógio do áudio: imagem e som andam juntos (sem atraso crescente). */
  private clockCtx?: AudioContext;
  private c0 = 0;
  private now() {
    if (this.clockCtx) return Math.round((this.clockCtx.currentTime - this.c0) * 1e6);
    return Math.round((performance.now() - this.t0) * 1000);
  }

  async stop() {
    if (!this.running) return;
    this.running = false;
    for (const r of this.readers) r.cancel().catch(() => {});
    this.worklet?.disconnect();
    this.stopTick?.();
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

  /** Muda a faixa de taxa no meio da live (ex.: Automático 4–8 Mbps ou Econômico travado em 4). */
  setRange(min: number, max: number) {
    this.min = min;
    this.max = max;
    this.want(Math.min(max, Math.max(min, max)));
  }

  private want(bps: number) {
    const r = Math.round(Math.min(this.max, Math.max(this.min, bps)) / 250_000) * 250_000;
    if (r !== this.rate) this.pendingRate = r;
  }

  /** Troca a taxa só no quadro-chave (começo de segmento): sem falhas na imagem. */
  private applyRate() {
    if (!this.pendingRate || !this.cfg || !this.venc) return;
    try {
      this.cfg = { ...this.cfg, bitrate: this.pendingRate };
      this.venc.configure(this.cfg);
      this.rate = this.pendingRate;
      this.status.rate = Math.round(this.rate / 1000);
    } catch {
      /* aparelho não aceitou trocar: segue na taxa atual */
    }
    this.pendingRate = 0;
  }

  /**
   * Taxa dinâmica (como no OBS): só baixa quando o envio fica para trás (fila crescendo ou o envio
   * demorando mais que o próprio vídeo) e sobe aos poucos quando sobra folga, até o máximo.
   * Mede pelo tempo, não pela velocidade: segmentos pequenos (imagem parada) não enganam a conta.
   */
  private adapt(ms: number, dur: number) {
    if (this.min >= this.max) return;
    const load = ms / 1000 / Math.max(0.5, dur); // 1 = demorou o mesmo que o vídeo
    const behind = this.uploads.length >= 1;
    if (behind || load > 1.6) this.want(this.rate * 0.75);
    else if (load < 0.6 && !this.uploads.length) this.want(this.rate + 1_000_000);
  }

  /** Quadro pronto da mesa de cenas (canvas no tamanho da live): codifica direto. */
  pushFrame(canvas: HTMLCanvasElement) {
    if (!this.running || !this.venc) return;
    const ts = this.now();
    if (ts < this.nextFrame) return;
    this.nextFrame = ts + (1e6 / this.o.fps) * 0.9;
    if (this.venc.encodeQueueSize > 3) return; // codificador atrasado: pula este quadro
    this.encFrames++;
    const out = new VideoFrame(canvas, { timestamp: ts });
    const key = ts - this.lastKeyAt >= SEGMENT_US;
    if (key) this.lastKeyAt = ts;
    if (key) this.applyRate();
    this.venc.encode(out, { keyFrame: key });
    out.close();
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
      this.encFrames++;
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
      if (key) this.applyRate();
      this.venc.encode(out, { keyFrame: key });
      out.close();
    }
  }

  /** Safari/iPad: lê o som do mixer em blocos de 1024 amostras (AudioWorklet) e manda para o codificador AAC. */
  private worklet?: AudioWorkletNode;
  private async captureAudio({ ctx, node }: { ctx: AudioContext; node: AudioNode }) {
    const code = `class Cap extends AudioWorkletProcessor {
      constructor() { super(); this.n = 0; this.l = new Float32Array(1024); this.r = new Float32Array(1024); }
      process(inputs) {
        const i = inputs[0];
        if (!i || !i.length) return true;
        const L = i[0], R = i[1] || i[0];
        for (let k = 0; k < L.length; k++) {
          this.l[this.n] = L[k]; this.r[this.n] = R[k]; this.n++;
          if (this.n === 1024) {
            const buf = new Float32Array(2048); buf.set(this.l, 0); buf.set(this.r, 1024);
            this.port.postMessage(buf, [buf.buffer]); this.n = 0;
          }
        }
        return true;
      }
    }
    registerProcessor('vertice-cap', Cap);`;
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const w = new AudioWorkletNode(ctx, 'vertice-cap', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 2, channelCountMode: 'explicit' });
    // precisa estar ligado a uma saída para processar; volume zero (não toca no alto-falante)
    const mute = ctx.createGain();
    mute.gain.value = 0;
    node.connect(w);
    w.connect(mute);
    mute.connect(ctx.destination);
    this.worklet = w;
    // a partir daqui, a imagem usa o mesmo relógio do som
    this.clockCtx = ctx;
    this.c0 = ctx.currentTime - (performance.now() - this.t0) / 1000;
    await this.setupAudio(ctx.sampleRate, 2);
    let samples = 0;
    w.port.onmessage = (e: MessageEvent<Float32Array<ArrayBuffer>>) => {
      if (!this.running || !this.aenc) return;
      if (this.audioFirstTs < 0) {
        this.audioFirstTs = 0;
        // começo deste bloco no relógio da live (o bloco tem 1024 amostras já capturadas)
        this.audioOffsetUs = this.now() - Math.round((1024 / ctx.sampleRate) * 1e6);
      }
      const data = new AudioData({
        format: 'f32-planar',
        sampleRate: ctx.sampleRate,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: Math.round((samples / ctx.sampleRate) * 1e6),
        data: e.data,
      });
      samples += 1024;
      try {
        this.aenc.encode(data);
      } catch {
        /* bloco inválido */
      }
      data.close();
    };
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
    const n = this.seq++;
    this.uploads.push({ n, name: `seg${n}.ts`, data, dur });
    // Rede muito lenta: mantém no máximo 4 segmentos esperando (pula os mais antigos)
    while (this.uploads.length > 4) this.settle(this.uploads.shift()!, false);
    if (send) void this.drain(false);
  }

  /**
   * Envio em paralelo (2 de cada vez), como o buffer de rede do OBS: um segmento lento não segura os outros.
   * A playlist só anda em ordem: um segmento entra nela quando todos os anteriores já chegaram.
   */
  private inflight = 0;
  private arrived = new Map<number, { name: string; dur: number } | null>();
  private nextInList = 0;
  private plRemoved = 0;
  private plChain: Promise<unknown> = Promise.resolve();

  private async drain(end: boolean) {
    this.pump();
    if (!end) return;
    while (this.uploads.length || this.inflight) await new Promise((r) => setTimeout(r, 100));
    await this.plChain;
    await this.postPlaylist(true);
  }

  private pump() {
    while (this.inflight < 2 && this.uploads.length) {
      const seg = this.uploads.shift()!;
      this.inflight++;
      void this.upload(seg).finally(() => {
        this.inflight--;
        this.pump();
      });
    }
  }

  private async upload(seg: { n: number; name: string; data: Uint8Array; dur: number }) {
    for (;;) {
      const t = performance.now();
      // em ordem: já manda a playlist junto (um pedido só)
      const inOrder = seg.n === this.nextInList;
      const list = inOrder ? this.windowWith({ name: seg.name, dur: seg.dur }) : null;
      const ok = await this.send(seg, list ? playlistText(list.items, list.first, false) : '');
      if (ok) {
        this.sent++;
        this.sentBytes += seg.data.length;
        this.failures = 0;
        if (this.status.state !== 'live' && this.running) this.status.state = 'live';
        this.adapt(performance.now() - t, seg.dur);
        this.settle(seg, true, Boolean(list));
        return;
      }
      this.failures++;
      this.status.state = 'reconnecting';
      this.want(this.rate * 0.75);
      this.emit();
      if (!this.running && this.failures > 3) return this.settle(seg, false);
      await new Promise((r) => setTimeout(r, Math.min(4000, 500 * this.failures)));
    }
  }

  private windowWith(extra?: { name: string; dur: number }) {
    const all = extra ? [...this.playlist, extra] : this.playlist;
    const cut = Math.max(0, all.length - 5);
    return { items: all.slice(cut), first: this.plRemoved + cut };
  }

  /** Segmento chegou (ou foi pulado): avança a playlist na ordem. */
  private settle(seg: { n: number; name: string; dur: number }, ok: boolean, posted = false) {
    this.arrived.set(seg.n, ok ? { name: seg.name, dur: seg.dur } : null);
    let moved = false;
    let onlyPosted = true;
    while (this.arrived.has(this.nextInList)) {
      const it = this.arrived.get(this.nextInList)!;
      this.arrived.delete(this.nextInList);
      if (it) {
        this.playlist.push(it);
        moved = true;
        if (!(posted && it.name === seg.name)) onlyPosted = false;
      }
      this.nextInList++;
    }
    while (this.playlist.length > 5) {
      this.playlist.shift();
      this.plRemoved++;
    }
    // a playlist que foi junto com o segmento já está certa; senão, atualiza só ela
    if (moved && !onlyPosted) void this.postPlaylist(false);
  }

  private postPlaylist(end: boolean) {
    this.plChain = this.plChain.then(async () => {
      const { items, first } = this.windowWith();
      if (!items.length) return;
      const text = playlistText(items, first, end);
      for (let i = 0; i < 4; i++) if (await this.send(null, text)) return;
    });
    return this.plChain;
  }

  private async send(seg: { name: string; data: Uint8Array } | null, playlist: string) {
    try {
      const url = `${this.o.endpoint ?? '/api/youtube/ingest'}?live=${encodeURIComponent(this.o.liveId)}${seg ? `&file=${seg.name}` : ''}`;
      const headers: Record<string, string> = { 'Content-Type': 'video/mp2t' };
      if (playlist) headers['X-Hls-Playlist'] = btoa(playlist);
      const res = await fetch(url, { method: 'POST', body: (seg ? seg.data : new Uint8Array(0)) as BodyInit, headers });
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
    this.stopTick?.();
  }

  private encFrames = 0;
  private frameWin: { t: number; e: number }[] = [];
  private frameStats() {
    const now = performance.now();
    this.frameWin.push({ t: now, e: this.encFrames });
    this.frameWin = this.frameWin.filter((w) => now - w.t <= 5000);
    const a = this.frameWin[0];
    const secs = Math.max(0.5, (now - a.t) / 1000);
    const e = this.encFrames - a.e;
    if (this.frameWin.length < 2) return { fps: this.o.fps, lost: 0 };
    const fps = e / secs;
    return { fps: Math.round(fps), lost: Math.max(0, Math.round((1 - fps / this.o.fps) * 100)) };
  }

  private emit() {
    const seconds = Math.round((performance.now() - this.t0) / 1000);
    this.status = {
      ...this.status,
      seconds,
      sent: this.sent,
      queue: this.uploads.length,
      ...this.frameStats(),
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
