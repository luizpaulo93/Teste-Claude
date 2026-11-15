/**
 * Mesa de cenas do Estúdio (como as cenas do OBS):
 * - "camera": só a câmera
 * - "screen": só a tela (tela inteira ou uma janela)
 * - "both": a tela com a câmera no canto
 * - "pdf": o PDF aberto no Estúdio (parte escolhida) com a câmera no canto
 * Desenha tudo num único quadro (canvas) no tamanho da live; a transmissão envia esse quadro.
 */
import { workerTicker, type Ticker } from './ticker';

export type Scene = 'camera' | 'screen' | 'both' | 'pdf';
export type Fit = 'cover' | 'contain';
export type Corner = 'br' | 'bl' | 'tr' | 'tl';

declare const MediaStreamTrackProcessor: {
  new (init: { track: MediaStreamTrack }): { readable: ReadableStream<VideoFrame> };
};

/** Quadro da câmera/tela: VideoFrame (Chrome) ou o próprio <video> (Safari, iPad, iPhone). */
type Frame = VideoFrame | HTMLVideoElement;
const fw = (f: Frame) => ('displayWidth' in f ? f.displayWidth : f.videoWidth);
const fh = (f: Frame) => ('displayHeight' in f ? f.displayHeight : f.videoHeight);

/** Safari não tem MediaStreamTrackProcessor: lê a câmera por um <video> escondido. */
class ElSource {
  private el: HTMLVideoElement;
  constructor(public track: MediaStreamTrack) {
    const el = document.createElement('video');
    el.muted = true;
    el.playsInline = true;
    el.autoplay = true;
    el.setAttribute('playsinline', '');
    el.srcObject = new MediaStream([track]);
    // No iPad o Safari desacelera vídeo fora da página: fica na página, invisível e minúsculo
    el.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1';
    document.body.appendChild(el);
    void el.play().catch(() => {});
    this.el = el;
  }
  get frame(): Frame | null {
    return this.el.readyState >= 2 && this.el.videoWidth > 0 ? this.el : null;
  }
  close() {
    this.el.pause();
    this.el.srcObject = null;
    this.el.remove();
  }
}

const hasProcessor = () => typeof (globalThis as { MediaStreamTrackProcessor?: unknown }).MediaStreamTrackProcessor !== 'undefined';
const makeSource = (t: MediaStreamTrack) => (hasProcessor() ? new Source(t) : new ElSource(t));

class Source {
  frame: VideoFrame | null = null;
  private reader: ReadableStreamDefaultReader<VideoFrame>;
  private alive = true;
  constructor(public track: MediaStreamTrack) {
    this.reader = new MediaStreamTrackProcessor({ track }).readable.getReader();
    void this.pump();
  }
  private async pump() {
    while (this.alive) {
      const { value, done } = await this.reader.read().catch(() => ({ value: undefined, done: true }));
      if (done || !value) break;
      if (!this.alive) {
        value.close();
        break;
      }
      this.frame?.close();
      this.frame = value; // fica sempre o quadro mais recente
    }
  }
  close() {
    this.alive = false;
    this.reader.cancel().catch(() => {});
    this.frame?.close();
    this.frame = null;
  }
}

type Rect = { x: number; y: number; w: number; h: number };
const FULL: Rect = { x: -1, y: -1, w: -1, h: -1 };
const union = (a: Rect | null, b: Rect | null): Rect | null => {
  if (!a || a.w <= 0 || a.h <= 0) return b && b.w > 0 && b.h > 0 ? b : null;
  if (!b || b.w <= 0 || b.h <= 0) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

export type TracoLayers = {
  bg: HTMLCanvasElement;
  hl: HTMLCanvasElement;
  ink: HTMLCanvasElement;
  live: HTMLCanvasElement;
  rev?: { bg: number; ink: number; live: number };
  /** há marca-texto na folha / há algo na camada do traço em andamento (senão a camada nem é copiada) */
  hlOn?: boolean;
  liveOn?: boolean;
  /** onde está o traço em andamento (pontos do canvas); sem ele, a camada toda */
  liveBox?: Rect | null;
  /** trecho das camadas que vai para a live (pontos do canvas) */
  crop?: { x: number; y: number; w: number; h: number };
};

export class Compositor {
  scene: Scene = 'camera';
  corner: Corner = 'br';
  /** câmera: giro (0, 90, 180, 270), espelho e encaixe no quadro */
  rotation = 0;
  mirror = false;
  fit: Fit = 'cover';
  /** posição do recorte da câmera (-1 a 1): escolhe a parte da imagem em pé que aparece na live horizontal */
  camX = 0;
  camY = 0;
  /** câmera no quadradinho nas cenas de tela e de PDF */
  pip = true;
  /** posição (canto de cima à esquerda) e largura do quadradinho, em fração do quadro */
  pipX = 0.7;
  pipY = 0.55;
  pipW = 0.28;
  /** caderno: câmera na camada da frente (por cima da escrita) enquanto o professor a move */
  camFront = false;
  /**
   * Caderno do estúdio (editor Traço): camadas da folha, desenhadas na live na ordem papel → câmera →
   * marca-texto → tinta → traço em andamento (a escrita fica por cima da câmera). As linhas do papel não entram.
   */
  traco?: () => TracoLayers | null;
  /**
   * Cópias das camadas do caderno no tamanho da live, refeitas só quando a camada muda (a folha do caderno é
   * desenhada na resolução da tela — redimensionar tudo a cada quadro pesava e travava a caneta).
   */
  private trCache: { base: HTMLCanvasElement; ink: HTMLCanvasElement; key: { base: string; ink: string } } | null = null;
  private cam: Source | ElSource | null = null;
  private screen: Source | ElSource | null = null;
  private ctx: CanvasRenderingContext2D;
  private tick: Ticker;
  private fps = 0;
  /** altura/largura da câmera do aparelho principal (para o retângulo no aparelho que só controla) */
  camAspect = 0;
  /** chamado a cada quadro desenhado (a transmissão codifica o canvas) */
  onFrame?: (canvas: HTMLCanvasElement) => void;

  constructor(
    public canvas: HTMLCanvasElement,
    fps = 30,
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.fps = fps;
    this.tick = workerTicker(1000 / fps, () => this.draw());
  }

  /** Muda o ritmo de desenho (a live com quadros adaptativos pede mais ou menos quadros). */
  setFps(fps: number) {
    fps = Math.max(1, fps);
    if (fps === this.fps && !this.paused) return;
    this.fps = fps;
    this.paused = false;
    this.tick.set(1000 / fps);
  }
  /** Para de desenhar (aparelho que só escreve no caderno: a prévia da live fica atrás dele e ninguém vê). */
  private paused = false;
  pause() {
    if (this.paused) return;
    this.paused = true;
    this.tick.set(0);
  }

  resize(w: number, h: number) {
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  setCamera(track: MediaStreamTrack | null) {
    if (this.cam?.track === track) return;
    this.cam?.close();
    this.cam = track ? makeSource(track) : null;
  }
  setScreen(track: MediaStreamTrack | null) {
    if (this.screen?.track === track) return;
    this.screen?.close();
    this.screen = track ? makeSource(track) : null;
  }
  get hasCamera() {
    return Boolean(this.cam);
  }
  /** Retângulo do quadradinho da câmera (fração do quadro), já dentro da tela. */
  pipRect() {
    const { width: W, height: H } = this.canvas;
    const f = this.cam?.frame;
    // sem câmera aqui (aparelho que só controla): usa o formato da câmera do aparelho principal
    const { w: cw, h: ch } = f ? this.camSize(f) : { w: 1, h: this.camAspect || 9 / 16 };
    const w = Math.min(0.9, Math.max(0.1, this.pipW));
    let h = (w * W * (ch / cw)) / H;
    let ww = w;
    if (h > 0.9) {
      ww = (w * 0.9) / h;
      h = 0.9;
    }
    const x = Math.min(Math.max(0, this.pipX), 1 - ww);
    const y = Math.min(Math.max(0, this.pipY), 1 - h);
    return { x, y, w: ww, h };
  }

  /** Arrasta o recorte da câmera (dx, dy em fração do quadro). */
  moveCamera(dx: number, dy: number) {
    const f = this.cam?.frame;
    if (!f) return;
    const { width: W, height: H } = this.canvas;
    const { w: cw, h: ch } = this.camSize(f);
    const sc = Math.max(W / cw, H / ch);
    const ex = Math.max(1, cw * sc - W) / 2;
    const ey = Math.max(1, ch * sc - H) / 2;
    this.camX = Math.max(-1, Math.min(1, this.camX - (dx * W) / ex));
    this.camY = Math.max(-1, Math.min(1, this.camY - (dy * H) / ey));
  }

  /** A câmera está em pé? (celular na vertical: a imagem vem mais alta que larga) */
  get cameraPortrait() {
    const f = this.cam?.frame;
    if (!f) return false;
    const { w, h } = this.camSize(f);
    return h > w * 1.05;
  }
  get hasScreen() {
    return Boolean(this.screen);
  }

  private fitFrame(f: Frame, x: number, y: number, w: number, h: number) {
    const sc = Math.min(w / fw(f), h / fh(f));
    const dw = fw(f) * sc;
    const dh = fh(f) * sc;
    this.ctx.drawImage(f, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  /** Largura/altura da câmera depois do giro */
  private camSize(f: Frame) {
    const side = this.rotation % 180 !== 0;
    return side ? { w: fh(f), h: fw(f) } : { w: fw(f), h: fh(f) };
  }

  /** Desenha a câmera girada/espelhada dentro do retângulo (preenchendo ou inteira). */
  private drawCam(f: Frame, x: number, y: number, w: number, h: number, fit: Fit, shift = false) {
    const c = this.ctx;
    const { w: cw, h: ch } = this.camSize(f);
    const sc = fit === 'cover' ? Math.max(w / cw, h / ch) : Math.min(w / cw, h / ch);
    // sobra da imagem fora do quadro (no recorte): o professor escolhe a parte que aparece
    const ex = shift ? Math.max(0, cw * sc - w) / 2 : 0;
    const ey = shift ? Math.max(0, ch * sc - h) / 2 : 0;
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    c.translate(x + w / 2 - this.camX * ex, y + h / 2 - this.camY * ey);
    c.rotate((this.rotation * Math.PI) / 180);
    if (this.mirror) c.scale(-1, 1);
    const dw = fw(f) * sc;
    const dh = fh(f) * sc;
    c.drawImage(f, -dw / 2, -dh / 2, dw, dh);
    c.restore();
  }

  /** desenha um quadro agora (também chamado pelo relógio) */
  draw() {
    const { width: W, height: H } = this.canvas;
    const c = this.ctx;
    const t = this.scene === 'pdf' ? (this.traco?.() ?? null) : null;
    if (t && t.bg.width) {
      this.drawPdf(t, this.cam?.frame ?? null, W, H);
      this.onFrame?.(this.canvas);
      return;
    }
    this.pdfLast = null;
    c.fillStyle = '#000';
    c.fillRect(0, 0, W, H);
    const cam = this.cam?.frame ?? null;
    const scr = this.screen?.frame ?? null;
    if (this.scene === 'camera') {
      if (cam) this.drawCam(cam, 0, 0, W, H, this.fit, true);
      else this.message('Sem câmera');
    } else if (this.scene === 'pdf') this.message('Abrindo o caderno…');
    else if (scr) this.fitFrame(scr, 0, 0, W, H);
    else this.message('Escolha a tela ou a janela para espelhar');
    // Câmera no quadradinho (onde o professor arrastar, no tamanho que escolher)
    if (this.scene === 'both' && cam) this.drawPip(cam, W, H);
    this.onFrame?.(this.canvas);
  }

  /** último quadro do caderno: o que pode ter mudado de lá para cá (câmera e traço em andamento) */
  /** quadros do caderno: inteiros, só um pedaço, nada a refazer (diagnóstico) */
  stats = { full: 0, part: 0, skip: 0 };
  private pdfLast: { key: string; pip: Rect | null; live: Rect | null } | null = null;

  /**
   * Caderno na live. A folha (papel, marca-texto, tinta) só muda quando se escreve; a cada quadro só a câmera e o
   * traço em andamento mudam — então só esses pedaços são redesenhados (o resto do quadro fica como estava).
   * Redesenhar o quadro inteiro 30 vezes por segundo ocupava a página e travava a caneta, a câmera e o vídeo.
   */
  private drawPdf(tr: TracoLayers, cam: Frame | null, W: number, H: number) {
    const c = this.ctx;
    const camOn = this.pip && !!cam;
    const front = this.camFront;
    const k = this.tracoCache(tr, W, H, !camOn || front);
    const inkTop = camOn && !front;
    if (inkTop) this.inkCache(tr, W, H);
    const cr = this.crop(tr);
    const sx = W / cr.w;
    const sy = H / cr.h;
    let pip: Rect | null = null;
    if (camOn) {
      const r = this.pipRect();
      const m = Math.max(2, Math.round(Math.min(W, H) / 300)) + 2;
      pip = { x: r.x * W - m, y: r.y * H - m, w: r.w * W + 2 * m, h: r.h * H + 2 * m };
    }
    let live: Rect | null = null;
    if (tr.liveOn) {
      const b = tr.liveBox;
      live = b ? (b.w > 0 ? { x: (b.x - cr.x) * sx, y: (b.y - cr.y) * sy, w: b.w * sx, h: b.h * sy } : null) : FULL;
    }
    const key = `${k.key.base}|${inkTop ? k.key.ink : '-'}|${camOn ? 1 : 0}|${front ? 1 : 0}|${W}x${H}`;
    const last = this.pdfLast;
    let dirty: Rect | null;
    if (!last || last.key !== key || live === FULL || last.live === FULL) dirty = FULL;
    else dirty = union(union(pip, last.pip), union(live, last.live));
    this.pdfLast = { key, pip, live };
    this.stats[!dirty ? 'skip' : dirty === FULL ? 'full' : 'part']++;
    if (!dirty) return;
    let d: Rect = { x: 0, y: 0, w: W, h: H };
    if (dirty !== FULL) {
      const x0 = Math.max(0, Math.floor(dirty.x));
      const y0 = Math.max(0, Math.floor(dirty.y));
      const x1 = Math.min(W, Math.ceil(dirty.x + dirty.w));
      const y1 = Math.min(H, Math.ceil(dirty.y + dirty.h));
      if (x1 <= x0 || y1 <= y0) return;
      d = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    const part = (img: CanvasImageSource) => c.drawImage(img, d.x, d.y, d.w, d.h, d.x, d.y, d.w, d.h);
    c.save();
    if (dirty !== FULL) {
      c.beginPath();
      c.rect(d.x, d.y, d.w, d.h);
      c.clip();
    }
    part(k.base);
    if (camOn && cam) this.drawPip(cam, W, H);
    if (inkTop) part(k.ink);
    if (tr.liveOn) c.drawImage(tr.live, cr.x + d.x / sx, cr.y + d.y / sy, d.w / sx, d.h / sy, d.x, d.y, d.w, d.h);
    c.restore();
  }

  /** a câmera no quadradinho (com o contorno branco) */
  private drawPip(cam: Frame, W: number, H: number) {
    const c = this.ctx;
    const r = this.pipRect();
    const x = r.x * W;
    const y = r.y * H;
    const pw = r.w * W;
    const ph = r.h * H;
    const rad = Math.round(pw * 0.05);
    c.save();
    c.beginPath();
    c.roundRect(x, y, pw, ph, rad);
    c.clip();
    this.drawCam(cam, x, y, pw, ph, 'cover');
    c.restore();
    c.lineWidth = Math.max(2, Math.round(Math.min(W, H) / 300));
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.beginPath();
    c.roundRect(x, y, pw, ph, rad);
    c.stroke();
  }

  private crop(tr: TracoLayers) {
    return tr.crop ?? { x: 0, y: 0, w: tr.bg.width, h: tr.bg.height };
  }

  /** tinta por cima da câmera: cópia no tamanho da live, refeita só quando a tinta muda */
  private inkCache(tr: TracoLayers, W: number, H: number) {
    const k = this.trCache!;
    const cr = this.crop(tr);
    const key = `${tr.rev ? tr.rev.ink : Math.random()}|${tr.ink.width}x${tr.ink.height}|${Math.round(cr.x)},${Math.round(cr.y)},${Math.round(cr.w)},${Math.round(cr.h)}`;
    if (k.key.ink !== key) {
      k.key.ink = key;
      const g = k.ink.getContext('2d')!;
      g.clearRect(0, 0, W, H);
      g.drawImage(tr.ink, cr.x, cr.y, cr.w, cr.h, 0, 0, W, H);
    }
  }

  /**
   * Cópia pronta da folha no tamanho da live: mesa + papel + marca-texto (+ tinta, quando nada fica entre a
   * folha e a tinta). Refeita só quando uma dessas camadas muda; a cada quadro é uma cópia só.
   */
  private tracoCache(tr: TracoLayers, W: number, H: number, withInk: boolean) {
    let k = this.trCache;
    if (!k || k.base.width !== W || k.base.height !== H) {
      const mk = (alpha: boolean) => {
        const x = document.createElement('canvas');
        x.width = W;
        x.height = H;
        x.getContext('2d', { alpha });
        return x;
      };
      k = this.trCache = { base: mk(false), ink: mk(true), key: { base: '', ink: '' } };
    }
    const r = tr.rev;
    const cr = this.crop(tr);
    const size = `${tr.bg.width}x${tr.bg.height}|${Math.round(cr.x)},${Math.round(cr.y)},${Math.round(cr.w)},${Math.round(cr.h)}`;
    const key = r ? `${r.bg}|${tr.hlOn || withInk ? r.ink : '-'}|${withInk ? 1 : 0}|${size}` : String(Math.random());
    if (k.key.base !== key) {
      k.key.base = key;
      const g = k.base.getContext('2d')!;
      // a mesa (no caderno ela é a cor de fundo da tela, não está desenhada)
      g.fillStyle = '#edf0f4';
      g.fillRect(0, 0, W, H);
      g.drawImage(tr.bg, cr.x, cr.y, cr.w, cr.h, 0, 0, W, H);
      if (tr.hlOn) {
        g.save();
        g.globalAlpha = 0.5;
        g.globalCompositeOperation = 'multiply';
        g.drawImage(tr.hl, cr.x, cr.y, cr.w, cr.h, 0, 0, W, H);
        g.restore();
      }
      if (withInk) g.drawImage(tr.ink, cr.x, cr.y, cr.w, cr.h, 0, 0, W, H);
    }
    return k;
  }

  private message(text: string) {
    const { width: W, height: H } = this.canvas;
    const c = this.ctx;
    c.fillStyle = '#9ca3af';
    c.font = `${Math.round(Math.min(W, H) / 22)}px sans-serif`;
    c.textAlign = 'center';
    c.fillText(text, W / 2, H / 2);
  }

  destroy() {
    this.tick.stop();
    this.cam?.close();
    this.screen?.close();
  }
}
