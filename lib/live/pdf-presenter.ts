/**
 * PDF na live: abre o PDF no próprio Estúdio e mostra a parte escolhida (página, zoom e posição).
 * Medidas em "larguras de página": a página tem largura 1 e altura `ratio`.
 */
import type { PDFDocumentProxy } from 'pdfjs-dist';

let lib: Promise<typeof import('pdfjs-dist')> | null = null;
function pdfjs() {
  if (!lib)
    lib = import('pdfjs-dist').then((m) => {
      m.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
      return m;
    });
  return lib;
}

export interface PdfView {
  page: number;
  pages: number;
  zoom: number;
}

export class PdfPresenter {
  private doc: PDFDocumentProxy | null = null;
  private canvas: HTMLCanvasElement | null = null; // página renderizada
  private rendering = 0;
  page = 1;
  pages = 0;
  /** 1 = a largura da página ocupa a largura do quadro */
  zoom = 1;
  /** canto de cima à esquerda da parte visível (em larguras de página) */
  cx = 0;
  cy = 0;
  ratio = 1.414;
  /** tamanho do quadro da live (para calcular a parte visível) */
  frameW = 1280;
  frameH = 720;
  onChange?: () => void;

  async load(data: ArrayBuffer) {
    const m = await pdfjs();
    void this.doc?.loadingTask.destroy();
    this.doc = await m.getDocument({ data }).promise;
    this.pages = this.doc.numPages;
    this.page = 1;
    this.zoom = 1;
    this.cx = 0;
    this.cy = 0;
    await this.render();
  }

  get view(): PdfView {
    return { page: this.page, pages: this.pages, zoom: this.zoom };
  }

  private get vw() {
    return 1 / this.zoom;
  }
  private get vh() {
    return this.vw * (this.frameH / this.frameW);
  }

  private clamp() {
    const vw = this.vw;
    const vh = this.vh;
    this.cx = vw >= 1 ? (1 - vw) / 2 : Math.min(Math.max(0, this.cx), 1 - vw);
    this.cy = vh >= this.ratio ? (this.ratio - vh) / 2 : Math.min(Math.max(0, this.cy), this.ratio - vh);
  }

  /** Renderiza a página na resolução certa para o zoom atual (nítida no vídeo). */
  private async render() {
    if (!this.doc) return;
    const ticket = ++this.rendering;
    const p = await this.doc.getPage(this.page);
    const base = p.getViewport({ scale: 1 });
    this.ratio = base.height / base.width;
    // largura de página em pixels = largura do quadro × zoom (com folga para ficar nítido), limitado
    let scale = ((this.frameW * Math.max(1, this.zoom) * 1.4) / base.width);
    const maxSide = 4096;
    scale = Math.min(scale, maxSide / base.width, maxSide / base.height);
    const vp = p.getViewport({ scale });
    const c = document.createElement('canvas');
    c.width = Math.ceil(vp.width);
    c.height = Math.ceil(vp.height);
    await p.render({ canvas: c, canvasContext: c.getContext('2d')!, viewport: vp }).promise;
    if (ticket !== this.rendering) return; // já pediram outra página/zoom
    this.canvas = c;
    this.clamp();
    this.onChange?.();
  }

  async goTo(page: number) {
    if (!this.doc) return;
    const n = Math.min(this.pages, Math.max(1, page));
    if (n === this.page) return;
    this.page = n;
    this.cy = 0;
    await this.render();
  }

  async setZoom(z: number) {
    const old = this.zoom;
    const next = Math.min(6, Math.max(0.3, z));
    // mantém o centro da parte visível
    const midX = this.cx + this.vw / 2;
    const midY = this.cy + this.vh / 2;
    this.zoom = next;
    this.cx = midX - this.vw / 2;
    this.cy = midY - this.vh / 2;
    this.clamp();
    this.onChange?.();
    if (Math.abs(next - old) > 0.01) await this.render();
  }

  /** Largura da página = largura do quadro */
  fitWidth() {
    void this.setZoom(1);
  }
  /** Página inteira no quadro */
  fitPage() {
    void this.setZoom(Math.min(1, this.frameW / this.frameH / this.ratio));
  }

  /** Move a parte visível (dx, dy em fração do quadro: 0.5 = meio quadro). */
  pan(dx: number, dy: number) {
    this.cx -= dx * this.vw;
    this.cy -= dy * this.vh;
    this.clamp();
    this.onChange?.();
  }

  draw(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    ctx.fillStyle = '#2b2f36';
    ctx.fillRect(x, y, w, h);
    if (!this.canvas) return;
    const px = this.canvas.width; // pixels por largura de página
    const sx = this.cx * px;
    const sy = this.cy * px;
    const sw = this.vw * px;
    const sh = this.vh * px;
    // recorta o que estiver fora da página (fundo cinza aparece nas bordas)
    const ix = Math.max(0, sx);
    const iy = Math.max(0, sy);
    const iw = Math.min(this.canvas.width, sx + sw) - ix;
    const ih = Math.min(this.canvas.height, sy + sh) - iy;
    if (iw <= 0 || ih <= 0) return;
    ctx.drawImage(this.canvas, ix, iy, iw, ih, x + ((ix - sx) / sw) * w, y + ((iy - sy) / sh) * h, (iw / sw) * w, (ih / sh) * h);
  }

  destroy() {
    void this.doc?.loadingTask.destroy();
    this.doc = null;
    this.canvas = null;
  }
}
