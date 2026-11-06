/**
 * PDF na live: abre o PDF no próprio Estúdio, com as páginas uma embaixo da outra (rolagem contínua),
 * zoom por pinça e a parte escolhida aparecendo na transmissão.
 * Medidas em "larguras de página": cada página tem largura 1 e altura = proporção dela (A4 ≈ 1,414).
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

export interface PdfPos {
  cx: number;
  cy: number;
  zoom: number;
}

export interface PdfView {
  page: number;
  pages: number;
  zoom: number;
}

const GAP = 0.025; // espaço entre as páginas
const KEEP = 10; // páginas renderizadas guardadas na memória

export class PdfPresenter {
  private doc: PDFDocumentProxy | null = null;
  private ratios: number[] = [];
  private tops: number[] = [];
  private total = 0;
  private cache = new Map<number, { canvas: HTMLCanvasElement; width: number; used: number }>();
  private queue = new Set<number>();
  private busy = false;
  private docId = 0;
  pages = 0;
  /** página que está no meio da tela */
  page = 1;
  /** 1 = a largura da página ocupa a largura do quadro */
  zoom = 1;
  /** canto de cima à esquerda da parte visível, no documento inteiro (em larguras de página) */
  cx = 0;
  cy = 0;
  frameW = 1280;
  frameH = 720;
  onChange?: () => void;
  /** a parte visível mudou por um gesto aqui (os outros aparelhos do estúdio seguem a mesma posição) */
  onView?: (v: PdfPos) => void;

  /** posição exata da parte visível */
  get pos(): PdfPos {
    return { cx: this.cx, cy: this.cy, zoom: this.zoom };
  }
  /** Mostra a mesma parte que outro aparelho (sem avisar de volta). */
  setView(v: PdfPos) {
    if (!this.doc) return;
    this.zoom = Math.min(6, Math.max(this.minZoom, v.zoom));
    this.cx = v.cx;
    this.cy = v.cy;
    this.clamp();
    this.onChange?.();
  }
  private moved() {
    this.onView?.(this.pos);
  }

  async load(data: ArrayBuffer) {
    const m = await pdfjs();
    void this.doc?.loadingTask.destroy();
    this.cache.clear();
    this.queue.clear();
    const id = ++this.docId;
    const doc = await m.getDocument({ data }).promise;
    this.doc = doc;
    this.pages = doc.numPages;
    const first = (await doc.getPage(1)).getViewport({ scale: 1 });
    this.ratios = Array.from({ length: this.pages }, () => first.height / first.width);
    this.layout();
    this.page = 1;
    this.zoom = 1;
    this.cx = 0;
    this.cy = 0;
    this.clamp();
    this.onChange?.();
    // proporção real de cada página, em segundo plano (PDFs com páginas de tamanhos diferentes)
    void (async () => {
      for (let i = 2; i <= this.pages && id === this.docId; i++) {
        const v = (await doc.getPage(i)).getViewport({ scale: 1 });
        const r = v.height / v.width;
        if (Math.abs(r - this.ratios[i - 1]) > 0.001) {
          this.ratios[i - 1] = r;
          this.layout();
        }
      }
    })().catch(() => {});
  }

  get view(): PdfView {
    return { page: this.page, pages: this.pages, zoom: this.zoom };
  }

  private layout() {
    let y = 0;
    this.tops = this.ratios.map((r) => {
      const t = y;
      y += r + GAP;
      return t;
    });
    this.total = Math.max(0, y - GAP);
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
    this.cy = vh >= this.total ? (this.total - vh) / 2 : Math.min(Math.max(0, this.cy), this.total - vh);
    // página atual = a que está no meio da tela
    const mid = this.cy + vh / 2;
    let p = 1;
    for (let i = 0; i < this.tops.length; i++) if (this.tops[i] <= mid) p = i + 1;
    this.page = p;
  }

  /** Menor zoom: a página inteira no quadro (bom para A4 em pé) */
  get minZoom() {
    const r = this.ratios[this.page - 1] ?? 1.414;
    return Math.min(1, this.frameW / this.frameH / r);
  }

  /** Vai para o começo da página (ou centraliza a página inteira, se ela couber) */
  async goTo(page: number) {
    if (!this.doc) return;
    const n = Math.min(this.pages, Math.max(1, page));
    const r = this.ratios[n - 1] ?? 1.414;
    this.cy = this.tops[n - 1] - (this.vh > r ? (this.vh - r) / 2 : 0);
    this.clamp();
    this.page = n;
    this.onChange?.();
    this.moved();
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
    this.moved();
  }

  async setZoom(z: number) {
    this.zoomAt(z / this.zoom);
  }

  /** Largura da página = largura do quadro (fica no começo da página atual) */
  fitWidth() {
    const n = this.page;
    this.zoom = 1;
    void this.goTo(n);
  }
  /** Página inteira no quadro */
  fitPage() {
    const n = this.page;
    this.zoom = this.minZoom;
    void this.goTo(n);
  }
  /** Dois toques: alterna entre largura e página inteira */
  toggleFit() {
    if (Math.abs(this.zoom - 1) < 0.02) this.fitPage();
    else this.fitWidth();
  }

  /** Move a parte visível (dx, dy em fração do quadro). As páginas seguem uma embaixo da outra. */
  pan(dx: number, dy: number) {
    this.cx -= dx * this.vw;
    this.cy -= dy * this.vh;
    const before = this.page;
    this.clamp();
    if (this.page !== before) this.onChange?.();
    this.moved();
  }

  // ---------------- renderização das páginas visíveis (nítidas para o zoom atual)
  private wantWidth(i: number) {
    const r = this.ratios[i - 1] ?? 1.414;
    return Math.min(this.frameW * this.zoom * 1.3, 4096, 4096 / r);
  }

  private request(i: number) {
    const c = this.cache.get(i);
    if (c) c.used = performance.now();
    const want = this.wantWidth(i);
    if (c && c.width >= want * 0.75 && c.width <= want * 1.8) return;
    if (this.queue.has(i)) return;
    this.queue.add(i);
    void this.pump();
  }

  private async pump() {
    if (this.busy || !this.doc) return;
    this.busy = true;
    try {
      while (this.queue.size && this.doc) {
        const i = this.queue.values().next().value as number;
        this.queue.delete(i);
        const id = this.docId;
        const p = await this.doc.getPage(i);
        const base = p.getViewport({ scale: 1 });
        const width = this.wantWidth(i);
        const vp = p.getViewport({ scale: width / base.width });
        const c = document.createElement('canvas');
        c.width = Math.ceil(vp.width);
        c.height = Math.ceil(vp.height);
        await p.render({ canvas: c, canvasContext: c.getContext('2d')!, viewport: vp }).promise;
        if (id !== this.docId) return;
        this.cache.set(i, { canvas: c, width, used: performance.now() });
        if (this.cache.size > KEEP) {
          const old = [...this.cache.entries()].sort((a, b) => a[1].used - b[1].used).slice(0, this.cache.size - KEEP);
          old.forEach(([k]) => this.cache.delete(k));
        }
      }
    } catch {
      /* página com erro: segue */
    } finally {
      this.busy = false;
    }
  }

  draw(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    ctx.fillStyle = '#2b2f36';
    ctx.fillRect(x, y, w, h);
    if (!this.pages) return;
    this.clamp();
    const vh = this.vh;
    const k = w / this.vw; // pixels do quadro por largura de página
    for (let i = 1; i <= this.pages; i++) {
      const top = this.tops[i - 1];
      const r = this.ratios[i - 1];
      if (top + r < this.cy) continue;
      if (top > this.cy + vh) break;
      const dx = x - this.cx * k;
      const dy = y + (top - this.cy) * k;
      const c = this.cache.get(i);
      if (c) ctx.drawImage(c.canvas, dx, dy, k, r * k);
      else {
        ctx.fillStyle = '#fff';
        ctx.fillRect(dx, dy, k, r * k);
      }
      this.request(i);
    }
    // já prepara a próxima página
    if (this.page < this.pages) this.request(this.page + 1);
  }

  destroy() {
    void this.doc?.loadingTask.destroy();
    this.doc = null;
    this.cache.clear();
  }
}
