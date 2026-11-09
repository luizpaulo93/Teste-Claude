/**
 * Mesa de cenas do Estúdio (como as cenas do OBS):
 * - "camera": só a câmera
 * - "screen": só a tela (tela inteira ou uma janela)
 * - "both": a tela com a câmera no canto
 * - "pdf": o PDF aberto no Estúdio (parte escolhida) com a câmera no canto
 * Desenha tudo num único quadro (canvas) no tamanho da live; a transmissão envia esse quadro.
 */
import type { PdfPresenter } from './pdf-presenter';
import { workerTicker } from './ticker';

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
  pdf: PdfPresenter | null = null;
  private cam: Source | ElSource | null = null;
  private screen: Source | ElSource | null = null;
  private ctx: CanvasRenderingContext2D;
  private stopTick: () => void;
  /** altura/largura da câmera do aparelho principal (para o retângulo no aparelho que só controla) */
  camAspect = 0;
  /** chamado a cada quadro desenhado (a transmissão codifica o canvas) */
  onFrame?: (canvas: HTMLCanvasElement) => void;

  constructor(
    public canvas: HTMLCanvasElement,
    fps = 30,
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.stopTick = workerTicker(1000 / fps, () => this.draw());
  }

  /** Muda o ritmo de desenho (a live com quadros adaptativos pede mais ou menos quadros). */
  setFps(fps: number) {
    this.stopTick();
    this.stopTick = workerTicker(1000 / Math.max(1, fps), () => this.draw());
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

  private draw() {
    const { width: W, height: H } = this.canvas;
    const c = this.ctx;
    c.fillStyle = '#000';
    c.fillRect(0, 0, W, H);
    const cam = this.cam?.frame ?? null;
    const scr = this.screen?.frame ?? null;
    if (this.scene === 'camera') {
      if (cam) this.drawCam(cam, 0, 0, W, H, this.fit, true);
      else this.message('Sem câmera');
    } else if (this.scene === 'pdf') {
      if (this.pdf) {
        this.pdf.frameW = W;
        this.pdf.frameH = H;
        this.pdf.draw(c, 0, 0, W, H);
      }
      if (!this.pdf?.pages) this.message('Escolha o PDF para mostrar');
    } else if (scr) this.fitFrame(scr, 0, 0, W, H);
    else this.message('Escolha a tela ou a janela para espelhar');

    // Câmera no quadradinho (onde o professor arrastar, no tamanho que escolher)
    if ((this.scene === 'both' || (this.scene === 'pdf' && this.pip)) && cam) {
      const r = this.pipRect();
      const x = r.x * W;
      const y = r.y * H;
      const pw = r.w * W;
      const ph = r.h * H;
      const short = Math.min(W, H);
      const rad = Math.round(pw * 0.05);
      c.save();
      c.beginPath();
      c.roundRect(x, y, pw, ph, rad);
      c.clip();
      this.drawCam(cam, x, y, pw, ph, 'cover');
      c.restore();
      c.lineWidth = Math.max(2, Math.round(short / 300));
      c.strokeStyle = 'rgba(255,255,255,0.85)';
      c.beginPath();
      c.roundRect(x, y, pw, ph, rad);
      c.stroke();
    }
    this.onFrame?.(this.canvas);
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
    this.stopTick();
    this.cam?.close();
    this.screen?.close();
  }
}
