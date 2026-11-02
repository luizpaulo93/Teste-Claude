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

  /** Menor zoom: a página inteira no quadro (bom para A4 em pé) */
  get minZoom() {
    return Math.min(1, this.frameW / this.frameH / this.ratio);
  }

  async goTo(page: number, atBottom = false) {
    if (!this.doc) return;
    const n = Math.min(this.pages, Math.max(1, page));
    if (n === this.page) return;
    this.page = n;
    this.over = 0;
    this.cy = atBottom ? this.ratio : 0; // clamp() leva para o fim da página
    await this.render();
  }

  // Re-renderiza a página só quando o zoom para de mudar (a pinça fica leve)
  private timer: ReturnType<typeof setTimeout> | undefined;
  private scheduleRender() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.render(), 160);
  }

  /** Zoom mantendo parado o ponto sob os dedos (fx, fy = fração do quadro, 0..1). */
  zoomAt(factor: number, fx = 0.5, fy = 0.5) {
    const next = Math.min(6, Math.max(this.minZoom, this.zoom * factor));
    if (Math.abs(next - this.zoom) < 1e-4) return;
    const px = this.cx + fx * this.vw;
    const py = this.cy + fy * this.vh;
    this.zoom = next;
    this.cx = px - fx * this.vw;
    this.cy = py - fy * this.vh;
    this.clamp();
    this.onChange?.();
    this.scheduleRender();
  }

  async setZoom(z: number) {
    this.zoomAt(z / this.zoom);
  }

  /** Largura da página = largura do quadro */
  fitWidth() {
    this.zoomAt(1 / this.zoom, 0.5, 0);
  }
  /** Página inteira no quadro */
  fitPage() {
    this.zoomAt(this.minZoom / this.zoom);
  }
  /** Dois toques: alterna entre largura e página inteira */
  toggleFit() {
    if (Math.abs(this.zoom - 1) < 0.02) this.fitPage();
    else this.fitWidth();
  }

  private over = 0;
  /**
   * Move a parte visível (dx, dy em fração do quadro). Passando do fim da página (rolando ou arrastando),
   * vai para a próxima; passando do começo, volta para a anterior.
   */
  pan(dx: number, dy: number, turnPages = false) {
    this.cx -= dx * this.vw;
    const want = this.cy - dy * this.vh;
    this.cy = want;
    this.clamp();
    if (turnPages) {
      const diff = (want - this.cy) / this.vh; // quanto passou do limite (em quadros)
      this.over = diff === 0 ? 0 : this.over + diff;
      if (this.over > 0.35 && this.page < this.pages) void this.goTo(this.page + 1);
      else if (this.over < -0.35 && this.page > 1) void this.goTo(this.page - 1, true);
    }
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
