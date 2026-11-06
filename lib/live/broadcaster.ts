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
  /** Aparelho que transmite agora (vai em cada envio; se outro assumir, o servidor recusa e este para) */
  lease?: string;
  /** Assumindo uma live que já estava no ar em outro aparelho: continua a playlist e o relógio dela */
  resume?: ResumeState | null;
  /** resolução da live (guardada para o próximo aparelho usar a mesma) */
  res?: '1080' | '720';
  /** Outro aparelho assumiu a transmissão */
  onHandoff?: () => void;
  /** Quadros por segundo adaptativos: sobe até maxFps quando o aparelho e a rede dão conta, desce até minFps */
  minFps?: number;
  maxFps?: number;
  /** a meta de quadros mudou (a mesa de cenas passa a desenhar nesse ritmo) */
  onFps?: (fps: number) => void;
}

/** Onde a playlist do YouTube parou (o próximo aparelho continua daqui). */
export interface ResumeState {
  msn: number;
  discSeq: number;
  items: { name: string; dur: number; disc?: boolean }[];
  nextName: number;
  endUs: number;
  res?: '1080' | '720';
}
type PlItem = { name: string; dur: number; disc?: boolean };

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
  /** meta de quadros por segundo agora (adaptativa) */
  target?: number;
  message?: string;
}

const SEGMENT_US = 2_000_000;
/** limite de um pedaço no servidor (a Vercel aceita até 4,5 MB por envio) */
const MAX_SEGMENT = 4_300_000;

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
  private playlist: PlItem[] = [];
  /** descontinuidades que já saíram da janela da playlist */
  private discRemoved = 0;
  /** primeiro segmento deste aparelho numa live retomada: marca descontinuidade (outro codificador) */
  private resumeDisc = false;
  /** fim do último segmento listado, no relógio da live (µs) */
  private listedEndUs = 0;
  private segEnds = new Map<number, number>();
  private uploads: { n: number; name: string; data: Uint8Array; dur: number }[] = [];
  private sentBytes = 0;
  private sent = 0;
  private failures = 0;
  private audioCfg?: { sampleRate: number; channels: number; adts: boolean };
  private readers: ReadableStreamDefaultReader[] = [];
  private status: BroadcastStatus = { state: 'starting', seconds: 0, sent: 0, queue: 0, kbps: 0 };
  private stopTick?: () => void;
  private nextFrame = 0;
  /** meta de quadros por segundo agora (entre minFps e maxFps) */
  private fpsNow = 30;
  private pendingFps = 0;
  private offered = 0;
  private skipped = 0;
  private calm = 0;
  private fpsCooldown = 0;
  private get fpsMin() {
    return this.o.minFps ?? this.o.fps;
  }
  private get fpsMax() {
    return this.o.maxFps ?? this.o.fps;
  }
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
    this.fpsNow = Math.min(this.fpsMax, Math.max(this.fpsMin, this.o.fps));
    const r = this.o.resume;
    if (r) {
      // mesma live: o tempo continua de onde o outro aparelho parou, a playlist também
      this.muxer.offsetUs = Math.max(0, Math.round(r.endUs)) + 200_000;
      this.playlist = r.items.slice(-5).map((x) => ({ name: x.name, dur: x.dur, disc: x.disc }));
      this.plRemoved = r.msn + Math.max(0, r.items.length - 5);
      this.discRemoved = r.discSeq;
      this.seq = r.nextName + 3; // folga: nunca regrava um arquivo que o outro aparelho possa ter enviado
      this.nextInList = this.seq;
      this.resumeDisc = true;
      this.listedEndUs = r.endUs;
    }
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
    // Som direto do mixer sempre que possível (todos os navegadores): imagem e som no mesmo relógio,
    // sem atraso acumulando em lives longas (como o OBS, que carimba tudo num relógio só)
    if (this.o.audioSource) await this.captureAudio(this.o.audioSource);
    else if (typeof MediaStreamTrackProcessor !== 'undefined' && at) void this.pumpAudio(at);
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
    const base = { width: this.o.width, height: this.o.height, bitrate: this.o.videoBitrate, framerate: this.fpsNow, avc: { format: 'annexb' as const } };
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

  /**
   * Relógio da live em µs. Segue o relógio do áudio (imagem e som nunca se afastam, mesmo em lives longas),
   * mas andando liso: o relógio do áudio anda aos saltos, então usamos o do sistema corrigido aos poucos
   * pela diferença entre os dois. Sem saltos = sem quadros descartados nem imagem "engasgando".
   */
  private clockCtx?: AudioContext;
  private c0 = 0;
  private drift = 0;
  private lastNow = -1;
  private audioSec() {
    const ctx = this.clockCtx!;
    const ts = ctx.getOutputTimestamp?.();
    // contextTime + tempo desde que ele foi medido = posição exata do áudio agora
    if (ts?.contextTime !== undefined && ts.performanceTime) return ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
    return ctx.currentTime;
  }
  private now() {
    const p = (performance.now() - this.t0) / 1000;
    let t = p;
    if (this.clockCtx) {
      const off = this.audioSec() - this.c0 - p;
      // segue o áudio devagar (sem saltos)
      if (Math.abs(off - this.drift) > 0.25) {
        // salto grande = o iPad pausou o som (notificação, Siri, ligação): a imagem segue no relógio do sistema
        this.c0 += off - this.drift;
      } else this.drift += (off - this.drift) * 0.02;
      t = p + this.drift;
    }
    const us = Math.max(this.lastNow + 1, Math.round(t * 1e6));
    this.lastNow = us;
    return us;
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
    if ((!this.pendingRate && !this.pendingFps) || !this.cfg || !this.venc) return;
    try {
      this.cfg = { ...this.cfg, bitrate: this.pendingRate || this.cfg.bitrate, framerate: this.pendingFps || this.cfg.framerate };
      this.venc.configure(this.cfg);
      if (this.pendingRate) this.rate = this.pendingRate;
      this.status.rate = Math.round(this.rate / 1000);
    } catch {
      /* aparelho não aceitou trocar: segue na taxa atual */
    }
    this.pendingRate = 0;
    this.pendingFps = 0;
  }

  /**
   * Quadros por segundo adaptativos (a cada 1 s): o aparelho perdendo quadros ou o envio atrasado → desce 6;
   * 5 s seguidos com folga → sobe 4. Sempre entre minFps e maxFps.
   */
  private lastFpsCheck = 0;
  private adaptFps(measured: number) {
    if (this.fpsMin >= this.fpsMax) return;
    const now = performance.now();
    if (now - this.lastFpsCheck < 900) return; // uma vez por segundo
    this.lastFpsCheck = now;
    const skip = this.offered ? this.skipped / this.offered : 0;
    this.offered = 0;
    this.skipped = 0;
    if (this.fpsCooldown > 0) {
      this.fpsCooldown--;
      return;
    }
    const overloaded = skip > 0.08 || (this.frameWin.length >= 4 && measured < this.fpsNow * 0.85);
    const behind = this.uploads.length >= 2 || this.status.state === 'reconnecting';
    let next = this.fpsNow;
    if (overloaded || behind) {
      next = Math.max(this.fpsMin, this.fpsNow - 6);
      this.calm = 0;
    } else if (++this.calm >= 5) {
      next = Math.min(this.fpsMax, this.fpsNow + 4);
      this.calm = 0;
    }
    if (next === this.fpsNow) return;
    this.fpsNow = next;
    this.pendingFps = next;
    this.fpsCooldown = 2; // deixa o ritmo novo assentar antes de medir de novo
    this.frameWin = [];
    this.o.onFps?.(next);
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
    // folga de 20%: o relógio da mesa de cenas oscila e nenhum quadro no ritmo certo é cortado
    this.nextFrame = ts + (1e6 / this.fpsNow) * 0.8;
    this.offered++;
    if (this.venc.encodeQueueSize > 3) {
      this.skipped++; // codificador atrasado: pula este quadro
      return;
    }
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
    const frameUs = () => 1e6 / this.fpsNow;
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
      next = ts + frameUs() * 0.9;
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
    this.c0 = this.audioSec() - (performance.now() - this.t0) / 1000;
    this.drift = 0;
    await this.setupAudio(ctx.sampleRate, 2);
    let samples = 0;
    const lags: number[] = [];
    w.port.onmessage = (e: MessageEvent<Float32Array<ArrayBuffer>>) => {
      if (!this.running || !this.aenc) return;
      if (this.audioFirstTs < 0) {
        this.audioFirstTs = 0;
        // começo deste bloco no relógio da live (o bloco tem 1024 amostras já capturadas)
        this.audioOffsetUs = this.now() - Math.round((1024 / ctx.sampleRate) * 1e6);
      }
      // Som voltou depois de uma pausa do sistema: recoloca no tempo certo (fica um silêncio, nunca atraso)
      const blockUs = (1024 / ctx.sampleRate) * 1e6;
      const lag = this.now() - blockUs - (this.audioOffsetUs + (samples / ctx.sampleRate) * 1e6);
      lags.push(lag);
      if (lags.length > 24) lags.shift();
      const minLag = Math.min(...lags); // o menor atraso recente ignora mensagens que só chegaram tarde
      if (lags.length >= 8 && minLag > 400_000) {
        this.audioOffsetUs += Math.round(minLag);
        lags.length = 0;
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
    const end = at === Infinity ? v[v.length - 1].pts + 1e6 / this.fpsNow : at;
    const dur = Math.max(0.1, (end - v[0].pts) / 1e6);
    const data = this.muxer.segment(v, a);
    this.segStart = at === Infinity ? -1 : at;
    const n = this.seq++;
    this.segEnds.set(n, end + this.muxer.offsetUs);
    this.uploads.push({ n, name: `seg${n}.ts`, data, dur });
    // Queda de internet: guarda até ~20 s de vídeo esperando e envia tudo quando voltar
    // (acima disso pula os mais antigos, para a live não ficar muito atrasada)
    while (this.uploads.length > 10) this.settle(this.uploads.shift()!, false);
    if (send) void this.drain(false);
  }

  /**
   * Envio em paralelo (2 de cada vez), como o buffer de rede do OBS: um segmento lento não segura os outros.
   * A playlist só anda em ordem: um segmento entra nela quando todos os anteriores já chegaram.
   */
  private inflight = 0;
  private arrived = new Map<number, PlItem | null>();
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
    let tries = 0;
    const firstTry = performance.now();
    for (;;) {
      const t = performance.now();
      // em ordem: já manda a playlist junto (um pedido só)
      // (só quando não há atualização de playlist pendente: ela nunca anda para trás)
      const inOrder = seg.n === this.nextInList && !this.plPending;
      const list = inOrder ? this.windowWith({ name: seg.name, dur: seg.dur, disc: this.discFor(seg.n) }) : null;
      // Pedaço maior que o servidor aceita (imagem pesada demais para a taxa): descarta e baixa a taxa
      const r =
        seg.data.length > MAX_SEGMENT
          ? 'drop'
          : await this.send(seg, list ? playlistText(list.items, list.first, false, list.disc) : '', list ? this.resumeOf(list, seg.n) : null);
      if (r === 'drop') {
        this.want(this.rate * 0.6);
        return this.settle(seg, false);
      }
      if (r === 'ok') {
        this.lastOkAt = Math.max(this.lastOkAt, t); // quando começou um envio que deu certo
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
      // nunca fica preso num pedaço: depois de várias tentativas, segue para os próximos
      // (se a internet caiu de vez, segura e envia quando voltar; a fila guarda ~20 s)
      // só desiste se outro envio começado depois deste conseguiu passar (a rede está ok, o problema é este pedaço)
      const othersGetThrough = this.lastOkAt > firstTry;
      if (++tries >= 6 && (othersGetThrough || !this.running)) return this.settle(seg, false);
      await new Promise((r) => setTimeout(r, Math.min(4000, 500 * this.failures)));
    }
  }

  private windowWith(extra?: PlItem) {
    const all = extra ? [...this.playlist, extra] : this.playlist;
    const cut = Math.max(0, all.length - 5);
    const disc = this.discRemoved + all.slice(0, cut).filter((x) => x.disc).length;
    return { items: all.slice(cut), first: this.plRemoved + cut, disc };
  }

  /** O primeiro segmento deste aparelho numa live retomada vem com descontinuidade. */
  private discFor(n: number) {
    return this.resumeDisc && n === this.firstOwn;
  }
  private get firstOwn() {
    return this.o.resume ? this.o.resume.nextName + 3 : 0;
  }

  /** Estado para o servidor guardar junto com a playlist (outro aparelho continua daqui). */
  private resumeOf(list: { items: PlItem[]; first: number; disc: number }, lastN: number): ResumeState {
    const endUs = this.segEnds.get(lastN) ?? this.listedEndUs;
    return { msn: list.first, discSeq: list.disc, items: list.items, nextName: this.seq, endUs, res: this.o.res };
  }

  /** Segmento chegou (ou foi pulado): avança a playlist na ordem. */
  private settle(seg: { n: number; name: string; dur: number }, ok: boolean, posted = false) {
    this.arrived.set(seg.n, ok ? { name: seg.name, dur: seg.dur, disc: this.discFor(seg.n) } : null);
    // segmento descartado logo no começo: a descontinuidade passa para o próximo
    if (!ok && this.discFor(seg.n) && this.o.resume) this.o.resume = { ...this.o.resume, nextName: this.o.resume.nextName + 1 };
    let moved = false;
    let onlyPosted = true;
    while (this.arrived.has(this.nextInList)) {
      const it = this.arrived.get(this.nextInList)!;
      this.arrived.delete(this.nextInList);
      if (it) {
        this.listedEndUs = this.segEnds.get(this.nextInList) ?? this.listedEndUs;
        this.segEnds.delete(this.nextInList);
        this.playlist.push(it);
        moved = true;
        if (!(posted && it.name === seg.name)) onlyPosted = false;
      }
      this.nextInList++;
    }
    while (this.playlist.length > 5) {
      if (this.playlist.shift()?.disc) this.discRemoved++;
      this.plRemoved++;
    }
    // a playlist que foi junto com o segmento já está certa; senão, atualiza só ela
    if (moved && !onlyPosted) void this.postPlaylist(false);
  }

  private plPending = 0;
  private lastOkAt = 0;
  private postPlaylist(end: boolean) {
    this.plPending++;
    this.plChain = this.plChain
      .then(async () => {
        const w = this.windowWith();
        if (!w.items.length) return;
        const text = playlistText(w.items, w.first, end, w.disc);
        const state = { msn: w.first, discSeq: w.disc, items: w.items, nextName: this.seq, endUs: this.listedEndUs, res: this.o.res };
        for (let i = 0; i < 4; i++) if ((await this.send(null, text, state)) !== 'retry') return;
      })
      .finally(() => this.plPending--);
    return this.plChain;
  }

  /** ok = chegou; retry = falha de rede (tenta de novo); drop = recusado (não adianta insistir) */
  private async send(seg: { name: string; data: Uint8Array } | null, playlist: string, resume: ResumeState | null = null): Promise<'ok' | 'retry' | 'drop'> {
    if (this.handedOff) return 'drop';
    try {
      const url = `${this.o.endpoint ?? '/api/youtube/ingest'}?live=${encodeURIComponent(this.o.liveId)}${seg ? `&file=${seg.name}` : ''}`;
      const headers: Record<string, string> = { 'Content-Type': 'video/mp2t' };
      if (playlist) headers['X-Hls-Playlist'] = btoa(playlist);
      if (this.o.lease) headers['X-Studio-Lease'] = this.o.lease;
      if (playlist && resume && this.o.lease) headers['X-Studio-Resume'] = btoa(unescape(encodeURIComponent(JSON.stringify(resume))));
      const res = await fetch(url, { method: 'POST', body: (seg ? seg.data : new Uint8Array(0)) as BodyInit, headers });
      if (res.status === 401 || res.status === 403 || res.status === 409) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        // outro aparelho assumiu: para sem encerrar a live
        if (body.code === 'handoff') {
          this.handoff();
          return 'drop';
        }
        const msg = body.error;
        this.fail(msg || 'O YouTube recusou a transmissão. Confira a chave da transmissão.');
        return 'drop'; // não insiste
      }
      if (res.ok) return 'ok';
      return res.status === 400 || res.status === 413 ? 'drop' : 'retry';
    } catch {
      return 'retry';
    }
  }

  private handedOff = false;
  /** Outro aparelho assumiu: para de codificar e de enviar (a live continua pelo outro). */
  private handoff() {
    if (this.handedOff) return;
    this.handedOff = true;
    this.abort('A transmissão passou para outro aparelho.');
    this.o.onHandoff?.();
  }

  /** Para tudo na hora, sem enviar o fim da live (outro aparelho segue, ou a live já foi encerrada). */
  abort(message = '') {
    this.running = false;
    for (const r of this.readers) r.cancel().catch(() => {});
    this.worklet?.disconnect();
    this.stopTick?.();
    this.uploads = [];
    try {
      this.venc?.close();
      this.aenc?.close();
    } catch {
      /* já fechado */
    }
    this.status = { ...this.status, state: 'stopped', message };
    this.emit();
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
    if (this.frameWin.length < 2) return { fps: this.fpsNow, lost: 0 };
    const fps = e / secs;
    return { fps: Math.round(fps), lost: Math.max(0, Math.round((1 - fps / this.fpsNow) * 100)) };
  }

  private emit() {
    const seconds = Math.round((performance.now() - this.t0) / 1000);
    const fr = this.frameStats();
    if (this.running) this.adaptFps(fr.fps);
    this.status = {
      ...this.status,
      seconds,
      sent: this.sent,
      queue: this.uploads.length,
      ...fr,
      target: this.fpsNow,
      kbps: seconds ? Math.round((this.sentBytes * 8) / 1000 / seconds) : 0,
    };
    this.o.onStatus?.({ ...this.status });
  }
}

function playlistText(list: PlItem[], firstSeq: number, end: boolean, discSeq = 0) {
  const target = Math.max(2, Math.ceil(Math.max(...list.map((s) => s.dur))));
  let t = `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:${target}\n#EXT-X-MEDIA-SEQUENCE:${firstSeq}\n`;
  // troca de aparelho no meio da live: outro codificador a partir daqui (padrão do HLS)
  if (discSeq || list.some((s) => s.disc)) t += `#EXT-X-DISCONTINUITY-SEQUENCE:${discSeq}\n`;
  for (const s of list) t += `${s.disc ? '#EXT-X-DISCONTINUITY\n' : ''}#EXTINF:${s.dur.toFixed(3)},\n${s.name}\n`;
  if (end) t += '#EXT-X-ENDLIST\n';
  return t;
}
