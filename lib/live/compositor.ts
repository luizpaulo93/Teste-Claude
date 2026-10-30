/**
 * Mesa de cenas do Estúdio (como as cenas do OBS):
 * - "camera": só a câmera
 * - "screen": só a tela (tela inteira ou uma janela)
 * - "both": a tela com a câmera no canto
 * Desenha tudo num único quadro (canvas) no tamanho da live; a transmissão envia esse quadro.
 */
import { workerTicker } from './ticker';

export type Scene = 'camera' | 'screen' | 'both';
export type Corner = 'br' | 'bl' | 'tr' | 'tl';

declare const MediaStreamTrackProcessor: {
  new (init: { track: MediaStreamTrack }): { readable: ReadableStream<VideoFrame> };
};

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
  private cam: Source | null = null;
  private screen: Source | null = null;
  private ctx: CanvasRenderingContext2D;
  private stopTick: () => void;
  /** chamado a cada quadro desenhado (a transmissão codifica o canvas) */
  onFrame?: (canvas: HTMLCanvasElement) => void;

  constructor(
    public canvas: HTMLCanvasElement,
    fps = 30,
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.stopTick = workerTicker(1000 / fps, () => this.draw());
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
    this.cam = track ? new Source(track) : null;
  }
  setScreen(track: MediaStreamTrack | null) {
    if (this.screen?.track === track) return;
    this.screen?.close();
    this.screen = track ? new Source(track) : null;
  }
  get hasCamera() {
    return Boolean(this.cam);
  }
  get hasScreen() {
    return Boolean(this.screen);
  }

  private fit(f: VideoFrame, x: number, y: number, w: number, h: number) {
    const s = Math.min(w / f.displayWidth, h / f.displayHeight);
    const dw = f.displayWidth * s;
    const dh = f.displayHeight * s;
    this.ctx.drawImage(f, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  private draw() {
    const { width: W, height: H } = this.canvas;
    const c = this.ctx;
    c.fillStyle = '#000';
    c.fillRect(0, 0, W, H);
    const cam = this.cam?.frame ?? null;
    const scr = this.screen?.frame ?? null;
    const main = this.scene === 'camera' ? cam : scr;
    if (main) this.fit(main, 0, 0, W, H);
    else {
      c.fillStyle = '#9ca3af';
      c.font = `${Math.round(H / 24)}px sans-serif`;
      c.textAlign = 'center';
      c.fillText(this.scene === 'camera' ? 'Sem câmera' : 'Escolha a tela ou a janela para espelhar', W / 2, H / 2);
    }
    // Câmera no canto
    if (this.scene === 'both' && cam) {
      const pw = Math.round(W * 0.26);
      const ph = Math.round((pw * cam.displayHeight) / cam.displayWidth);
      const m = Math.round(W * 0.02);
      const x = this.corner.endsWith('r') ? W - pw - m : m;
      const y = this.corner.startsWith('b') ? H - ph - m : m;
      const r = Math.round(pw * 0.05);
      c.save();
      c.beginPath();
      c.roundRect(x, y, pw, ph, r);
      c.clip();
      c.drawImage(cam, x, y, pw, ph);
      c.restore();
      c.lineWidth = Math.max(2, Math.round(W / 400));
      c.strokeStyle = 'rgba(255,255,255,0.85)';
      c.beginPath();
      c.roundRect(x, y, pw, ph, r);
      c.stroke();
    }
    this.onFrame?.(this.canvas);
  }

  destroy() {
    this.stopTick();
    this.cam?.close();
    this.screen?.close();
  }
}
