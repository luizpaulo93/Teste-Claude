/**
 * Escrita por cima do PDF do estúdio (caneta, marca-texto, laser, borracha e seleção).
 * Os traços ficam guardados nas coordenadas do documento (largura da página = 1), então acompanham
 * o zoom, a rolagem e a troca de página, e são redesenhados na resolução da live (sem pixelar).
 */
export type InkTool = 'hand' | 'pen' | 'marker' | 'laser' | 'eraser' | 'select' | 'shape';
export type ShapeKind = 'line' | 'arrow' | 'rect' | 'ellipse';

/** Pontos de uma forma (reta, seta, retângulo, elipse) entre onde o toque começou e onde está. */
export function shapePoints(kind: ShapeKind, x0: number, y0: number, x1: number, y1: number): number[] {
  if (kind === 'rect') return [x0, y0, x1, y0, x1, y1, x0, y1, x0, y0];
  if (kind === 'ellipse') {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const rx = Math.abs(x1 - x0) / 2;
    const ry = Math.abs(y1 - y0) / 2;
    const out: number[] = [];
    for (let i = 0; i <= 48; i++) out.push(cx + rx * Math.cos((i / 48) * 2 * Math.PI), cy + ry * Math.sin((i / 48) * 2 * Math.PI));
    return out;
  }
  if (kind === 'arrow') {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const h = Math.min(len * 0.35, Math.max(0.012, len * 0.18));
    const a = Math.atan2(y1 - y0, x1 - x0);
    const p = (da: number) => [x1 - h * Math.cos(a + da), y1 - h * Math.sin(a + da)];
    return [x0, y0, x1, y1, ...p(0.45), x1, y1, ...p(-0.45)];
  }
  return [x0, y0, x1, y1];
}

export interface Stroke {
  id: string;
  tool: 'pen' | 'marker';
  color: string;
  /** espessura em larguras de página */
  size: number;
  /** pontos x,y,x,y… em coordenadas do documento */
  pts: number[];
  /** pressão da caneta em cada ponto (0..1); sem ela, a espessura segue a velocidade */
  pr?: number[];
  /** forma geométrica (reta, seta, retângulo, elipse): linha reta entre os pontos, espessura fixa */
  shape?: boolean;
  /** forma com linha tracejada */
  dash?: boolean;
}
export interface InkOps {
  add?: Stroke[];
  remove?: string[];
}
/**
 * Traço compacto (o que vai pela rede e fica guardado): pontos como diferenças pequenas num texto curto.
 * Um traço de 100 pontos ocupa ~200 bytes em vez de ~2 KB.
 */
export interface PackedStroke {
  id: string;
  tool: 'pen' | 'marker';
  color: string;
  size: number;
  /** pontos (x,y) */
  d: string;
  /** pressão em cada ponto */
  p?: string;
  /** 1 = forma geométrica; 2 = forma tracejada */
  s?: 1 | 2;
  /** 1 = pontos com precisão fina (centésimo de milésimo da página): letra lisa mesmo com muito zoom */
  q?: 1;
}
export interface PackedOps {
  add?: PackedStroke[];
  remove?: string[];
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64I = new Map([...B64].map((c, i) => [c, i]));
export const PACKED_RE = /^[A-Za-z0-9_-]*$/;
/** número inteiro em 1 caractere (se pequeno) ou mais: 5 bits por caractere + "continua" */
function putInt(out: string[], n: number) {
  let z = n < 0 ? -2 * n - 1 : 2 * n;
  do {
    let c = z % 32;
    z = Math.floor(z / 32);
    if (z) c += 32;
    out.push(B64[c]);
  } while (z);
}
function getInts(s: string): number[] {
  const out: number[] = [];
  let z = 0;
  let mul = 1;
  for (const ch of s) {
    const v = B64I.get(ch);
    if (v === undefined) break;
    z += (v % 32) * mul;
    if (v >= 32) mul *= 32;
    else {
      out.push(z % 2 ? -(z + 1) / 2 : z / 2);
      z = 0;
      mul = 1;
    }
  }
  return out;
}
/** valores em diferenças em relação ao anterior (os pontos de um traço ficam perto uns dos outros) */
function packSeq(vals: number[], step: number, stride: number) {
  const out: string[] = [];
  const last = new Array(stride).fill(0);
  for (let i = 0; i < vals.length; i++) {
    const q = Math.round(vals[i] * step);
    putInt(out, q - last[i % stride]);
    last[i % stride] = q;
  }
  return out.join('');
}
function unpackSeq(s: string, step: number, stride: number) {
  const d = getInts(s);
  const last = new Array(stride).fill(0);
  return d.map((v, i) => {
    last[i % stride] += v;
    return last[i % stride] / step;
  });
}
export function packStroke(s: Stroke): PackedStroke {
  const p: PackedStroke = { id: s.id, tool: s.tool, color: s.color, size: Math.round(s.size * 1e6) / 1e6, d: packSeq(s.pts, 100000, 2), q: 1 };
  if (s.pr) p.p = packSeq(s.pr, 50, 1);
  if (s.shape) p.s = s.dash ? 2 : 1;
  return p;
}
export function unpackStroke(x: PackedStroke | Stroke): Stroke | null {
  if (!x || typeof x.id !== 'string') return null;
  if ('pts' in x && Array.isArray(x.pts)) return x;
  const k = x as PackedStroke;
  if (typeof k.d !== 'string') return null;
  const pts = unpackSeq(k.d, k.q === 1 ? 100000 : 10000, 2);
  if (pts.length < 2) return null;
  if (pts.length % 2) pts.pop();
  const s: Stroke = { id: k.id, tool: k.tool === 'marker' ? 'marker' : 'pen', color: k.color, size: k.size, pts };
  if (typeof k.p === 'string') {
    const pr = unpackSeq(k.p, 50, 1);
    if (pr.length === pts.length / 2) s.pr = pr;
  }
  if (k.s === 1 || k.s === 2) s.shape = true;
  if (k.s === 2) s.dash = true;
  return s;
}
export const packOps = (o: InkOps): PackedOps => ({ ...(o.add ? { add: o.add.map(packStroke) } : {}), ...(o.remove ? { remove: o.remove } : {}) });
export const unpackOps = (o: PackedOps | InkOps): InkOps => ({
  ...(o.add ? { add: (o.add as (PackedStroke | Stroke)[]).map(unpackStroke).filter((s): s is Stroke => Boolean(s)) } : {}),
  ...(o.remove ? { remove: o.remove } : {}),
});

/**
 * Tira pontos que não mudam o desenho (desvio menor que uma fração da espessura): menos dados para
 * guardar e mandar. Mantém os pontos onde a pressão muda.
 */
function simplify(s: Stroke, unit = 0): Stroke {
  const n = s.pts.length / 2;
  if (n < 3) return s;
  // tolerância pequena: mantém bastante ponto para a curva não mostrar falhas
  // (com zoom, a tolerância acompanha a tela: um sexto de ponto da tela, senão a curva fica quebrada de perto)
  const eps = unit ? Math.min(s.size * 0.04, 0.0002, unit * 0.16) : Math.min(s.size * 0.04, 0.0002);
  const P = s.pts;
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let far = -1;
    let dmax = eps;
    for (let i = a + 1; i < b; i++) {
      const d = segDist(P[2 * i], P[2 * i + 1], P[2 * a], P[2 * a + 1], P[2 * b], P[2 * b + 1]);
      if (d > dmax) {
        dmax = d;
        far = i;
      }
    }
    if (far > 0) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  if (s.pr) {
    let last = 0;
    for (let i = 1; i < n; i++) {
      if (Math.abs(s.pr[i] - s.pr[last]) > 0.08) keep[i] = 1;
      if (keep[i]) last = i;
    }
  }
  const pts: number[] = [];
  const pr: number[] = [];
  for (let i = 0; i < n; i++)
    if (keep[i]) {
      pts.push(P[2 * i], P[2 * i + 1]);
      if (s.pr) pr.push(s.pr[i]);
    }
  return { ...s, pts, ...(s.pr ? { pr } : {}) };
}
/** onde o PDF está no quadro: tela = x + (docX − cx)·k */
export interface InkView {
  x: number;
  y: number;
  k: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
}

const LASER_HOLD = 1200; // ms depois de soltar antes de começar a sumir
const LASER_FADE = 800; // ms sumindo

const r4 = (n: number) => Math.round(n * 100000) / 100000;
const r2 = (n: number) => Math.round(n * 50) / 50;
/** o contorno é calculado com a página = 1000 unidades (as medidas internas da biblioteca são em "pixels") */
const U = 1000;

/**
 * Contorno da caneta (tinta que desliza): espessura pela pressão da Apple Pencil (ou pela velocidade),
 * curva suavizada e pontas arredondadas. Devolve x,y,x,y… em coordenadas do documento.
 */
export const newStrokeId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

type Box = { x0: number; y0: number; x1: number; y1: number };
function boxOf(s: Stroke): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < s.pts.length; i += 2) {
    x0 = Math.min(x0, s.pts[i]);
    x1 = Math.max(x1, s.pts[i]);
    y0 = Math.min(y0, s.pts[i + 1]);
    y1 = Math.max(y1, s.pts[i + 1]);
  }
  const p = s.size / 2;
  return { x0: x0 - p, y0: y0 - p, x1: x1 + p, y1: y1 + p };
}
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export class InkLayer {
  /** muda a cada alteração nos traços (a imagem pronta da escrita é refeita só nessa hora) */
  private ver = 0;
  private list: Stroke[] = [];
  get strokes() {
    return this.list;
  }
  set strokes(v: Stroke[]) {
    this.list = v;
    this.ver++;
  }
  /** traço sendo desenhado agora */
  current: Stroke | null = null;
  /** lasers: escritos como a caneta (mesmo traço liso); somem sozinhos depois de soltar (`end`) */
  lasers = new Map<string, { color: string; size: number; pts: number[]; end: number | null }>();
  selected = new Set<string>();
  private boxes = new WeakMap<Stroke, Box>();

  private box(s: Stroke) {
    let b = this.boxes.get(s);
    if (!b) {
      b = boxOf(s);
      this.boxes.set(s, b);
    }
    return b;
  }

  // ---------------- desenho
  /** traços terminados de um tipo que aparecem na parte visível */
  private drawDone(ctx: CanvasRenderingContext2D, v: InkView, tool: 'pen' | 'marker', exact = true) {
    const vx0 = v.cx;
    const vy0 = v.cy;
    const vx1 = v.cx + v.w / v.k;
    const vy1 = v.cy + v.h / v.k;
    let any = false;
    for (const s of this.list) {
      if (s.tool !== tool) continue;
      const b = this.box(s);
      if (b.x1 < vx0 || b.x0 > vx1 || b.y1 < vy0 || b.y0 > vy1) continue;
      this.drawStroke(ctx, s, v, false, exact);
      any = true;
    }
    return any;
  }

  /** versão dos traços: muda a cada alteração (quem guarda a escrita pronta como imagem refaz só nessa hora) */
  get version() {
    return this.ver;
  }
  /** quantos traços há (traços novos entram no fim sem mudar a versão) */
  get count() {
    return this.list.length;
  }
  /** só a caneta e as formas (camada nítida, na resolução da tela, do aparelho que escreve) */
  drawPens(ctx: CanvasRenderingContext2D, v: InkView, exact: boolean, from = 0) {
    const vx1 = v.cx + v.w / v.k;
    const vy1 = v.cy + v.h / v.k;
    for (let i = from; i < this.list.length; i++) {
      const s = this.list[i];
      if (s.tool !== 'pen') continue;
      const b = this.box(s);
      if (b.x1 < v.cx || b.x0 > vx1 || b.y1 < v.cy || b.y0 > vy1) continue;
      this.drawStroke(ctx, s, v, false, exact);
    }
  }
  /** desenha só os traços a partir de `from` (acrescenta à imagem pronta, sem redesenhar a página) */
  drawTail(ctx: CanvasRenderingContext2D, v: InkView, from: number) {
    for (let i = from; i < this.list.length; i++) this.drawStroke(ctx, this.list[i], v, false);
  }
  /** há algo se mexendo (traço sendo escrito ou laser sumindo): desenhado a cada quadro */
  get busy() {
    return Boolean(this.current || this.lasers.size);
  }

  /** escrita terminada: marca-texto por baixo da caneta (a letra fica por cima do destaque) */
  drawDoneAll(ctx: CanvasRenderingContext2D, v: InkView, exact = true) {
    if (!this.list.length) return;
    this.drawDone(ctx, v, 'marker', exact);
    this.drawDone(ctx, v, 'pen');
  }
  /** o que muda a cada quadro: traço em andamento e laser */
  drawLive(ctx: CanvasRenderingContext2D, v: InkView) {
    if (this.current) this.drawStroke(ctx, this.current, v, true);
    if (this.lasers.size) this.drawLasers(ctx, v);
  }
  draw(ctx: CanvasRenderingContext2D, v: InkView) {
    this.drawDoneAll(ctx, v);
    this.drawLive(ctx, v);
  }

  /** desenha um traço (também usado pela camada rápida que mostra o traço enquanto escreve) */
  drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, v: InkView, live = s === this.current, exact = true) {
    if (s.shape) this.poly(ctx, s, v);
    else if (s.tool === 'pen') this.fillPen(ctx, s, v, exact);
    else if (exact) this.path(ctx, s, v);
    else this.quickPath(ctx, s, v);
  }

  /** marca-texto num traço só (leve): usado enquanto o PDF está em movimento (zoom/rolagem) */
  private quickPath(ctx: CanvasRenderingContext2D, s: Stroke, v: InkView) {
    const p = s.pts;
    if (p.length < 2) return;
    const X = (i: number) => v.x + (p[i] - v.cx) * v.k;
    const Y = (i: number) => v.y + (p[i + 1] - v.cy) * v.k;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = s.color;
    ctx.lineWidth = Math.max(1, s.size * v.k);
    ctx.globalAlpha = 0.38;
    ctx.globalCompositeOperation = 'multiply';
    ctx.beginPath();
    ctx.moveTo(X(0), Y(0));
    if (p.length === 2) ctx.lineTo(X(0) + 0.01, Y(0));
    for (let i = 2; i < p.length - 2; i += 2) ctx.quadraticCurveTo(X(i), Y(i), (X(i) + X(i + 2)) / 2, (Y(i) + Y(i + 2)) / 2);
    if (p.length > 2) ctx.lineTo(X(p.length - 2), Y(p.length - 2));
    ctx.stroke();
    ctx.restore();
  }

  /** forma geométrica: segmentos retos, espessura fixa */
  private poly(ctx: CanvasRenderingContext2D, s: Stroke, v: InkView) {
    const p = s.pts;
    if (p.length < 4) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = s.color;
    ctx.lineWidth = Math.max(1, s.size * v.k);
    if (s.dash) ctx.setLineDash([Math.max(4, s.size * v.k * 3.5), Math.max(4, s.size * v.k * 3)]);
    ctx.beginPath();
    ctx.moveTo(v.x + (p[0] - v.cx) * v.k, v.y + (p[1] - v.cy) * v.k);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(v.x + (p[i] - v.cx) * v.k, v.y + (p[i + 1] - v.cy) * v.k);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Caneta: linha de espessura constante com pontas redondas (esferográfica), passando exatamente pelos
   * pontos por onde a Pencil passou. Fiel à mão: sem contorno calculado, sem "arredondar" a letra.
   */
  private fillPen(ctx: CanvasRenderingContext2D, s: Stroke, v: InkView, exact: boolean) {
    ctx.save();
    ctx.strokeStyle = s.color;
    this.strokeCurve(ctx, s.pts, v, Math.max(0.6, s.size * v.k), exact, s.pr && s.pr.length === s.pts.length / 2 ? s.pr : undefined);
    ctx.restore();
  }

  /**
   * Curva suave que passa por todos os pontos (Catmull-Rom). `exact`: um pedaço de cada vez — os pedaços se
   * somam e o traço nunca fica com falhas onde cruza o próprio caminho; senão, um caminho só (mais leve,
   * usado com o PDF em movimento).
   */
  private strokeCurve(ctx: CanvasRenderingContext2D, p: number[], v: InkView, lw: number, exact: boolean, pr?: number[]) {
    // pressão → espessura entre 80% e 125% (variação leve, como caneta de verdade)
    const W = (i: number) => (pr ? lw * (0.8 + 0.45 * Math.min(1, Math.max(0, pr[i] * 1.15 + 0.2))) : lw);
    const n = p.length / 2;
    if (n < 1) return;
    const X = (i: number) => v.x + (p[2 * Math.min(n - 1, Math.max(0, i))] - v.cx) * v.k;
    const Y = (i: number) => v.y + (p[2 * Math.min(n - 1, Math.max(0, i)) + 1] - v.cy) * v.k;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw;
    if (n === 1 || (n === 2 && Math.hypot(X(1) - X(0), Y(1) - Y(0)) < 0.5)) {
      // toque curto (pingo do "i", ponto final)
      ctx.lineWidth = W(0);
      ctx.beginPath();
      ctx.moveTo(X(0), Y(0));
      ctx.lineTo(X(0) + 0.01, Y(0));
      ctx.stroke();
      return;
    }
    // espessura fixa: desenha em blocos de 24 pedaços (dezenas de vezes mais leve que pedaço a pedaço, e o
    // traço que cruza o próprio caminho continua sem buracos)
    const chunk = exact && !pr;
    if (chunk) exact = false;
    if (!exact) ctx.beginPath();
    if (!exact) ctx.moveTo(X(0), Y(0));
    for (let i = 0; i < n - 1; i++) {
      if (chunk && i && i % 24 === 0) {
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(X(i), Y(i));
      }
      const c1x = X(i) + (X(i + 1) - X(i - 1)) / 6;
      const c1y = Y(i) + (Y(i + 1) - Y(i - 1)) / 6;
      const c2x = X(i + 1) - (X(i + 2) - X(i)) / 6;
      const c2y = Y(i + 1) - (Y(i + 2) - Y(i)) / 6;
      if (exact) {
        if (pr) ctx.lineWidth = (W(i) + W(i + 1)) / 2;
        ctx.beginPath();
        ctx.moveTo(X(i), Y(i));
      }
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, X(i + 1), Y(i + 1));
      if (exact) ctx.stroke();
    }
    if (!exact) ctx.stroke();
  }

  /** camada de rascunho do marca-texto (reaproveitada) */
  private scratch: HTMLCanvasElement | null = null;

  /**
   * Marca-texto (e traço simples). O traço é desenhado opaco, pedaço a pedaço, numa camada à parte e só
   * depois entra transparente na página: onde ele passa por cima de si mesmo fica coberto por igual, sem
   * os "buracos" que o navegador deixa quando um traço grosso cruza o próprio caminho.
   */
  private path(ctx: CanvasRenderingContext2D, s: Stroke, v: InkView) {
    const p = s.pts;
    if (p.length < 2) return;
    const lw = Math.max(1, s.size * v.k);
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    // área do traço na tela (com folga da espessura)
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < p.length; i += 2) {
      const x = v.x + (p[i] - v.cx) * v.k;
      const y = v.y + (p[i + 1] - v.cy) * v.k;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    x0 = Math.max(0, Math.floor(x0 - lw));
    y0 = Math.max(0, Math.floor(y0 - lw));
    x1 = Math.min(W, Math.ceil(x1 + lw));
    y1 = Math.min(H, Math.ceil(y1 + lw));
    if (x1 <= x0 || y1 <= y0) return;
    const layer = typeof document !== 'undefined' ? (this.scratch ??= document.createElement('canvas')) : null;
    if (!layer) return;
    if (layer.width < W || layer.height < H) {
      layer.width = Math.max(layer.width, W);
      layer.height = Math.max(layer.height, H);
    }
    const g = layer.getContext('2d')!;
    g.clearRect(x0, y0, x1 - x0, y1 - y0);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = s.color;
    g.lineWidth = lw;
    const X = (i: number) => v.x + (p[i] - v.cx) * v.k;
    const Y = (i: number) => v.y + (p[i + 1] - v.cy) * v.k;
    const n = p.length;
    if (n === 2) {
      g.beginPath();
      g.moveTo(X(0), Y(0));
      g.lineTo(X(0) + 0.01, Y(0));
      g.stroke();
    } else {
      // curva suave pelos pontos médios, um pedaço de cada vez (os pedaços se somam, nunca se anulam)
      let px = X(0);
      let py = Y(0);
      for (let i = 2; i < n; i += 2) {
        const last = i >= n - 2;
        const ex = last ? X(i) : (X(i) + X(i + 2)) / 2;
        const ey = last ? Y(i) : (Y(i) + Y(i + 2)) / 2;
        g.beginPath();
        g.moveTo(px, py);
        if (last) g.lineTo(ex, ey);
        else g.quadraticCurveTo(X(i), Y(i), ex, ey);
        g.stroke();
        px = ex;
        py = ey;
      }
    }
    ctx.save();
    if (s.tool === 'marker') {
      ctx.globalAlpha = 0.38;
      ctx.globalCompositeOperation = 'multiply';
    }
    ctx.drawImage(layer, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
  }

  drawLasers(ctx: CanvasRenderingContext2D, v: InkView) {
    const now = performance.now();
    for (const [id, l] of this.lasers) {
      const age = l.end === null ? 0 : now - l.end;
      if (age > LASER_HOLD + LASER_FADE) {
        this.lasers.delete(id);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = age < LASER_HOLD ? 1 : Math.max(0, 1 - (age - LASER_HOLD) / LASER_FADE);
      ctx.shadowColor = l.color;
      ctx.shadowBlur = Math.max(6, l.size * v.k * 1.5);
      ctx.strokeStyle = l.color;
      // um caminho só: com brilho, pedaços separados somariam a sombra
      this.strokeCurve(ctx, l.pts, v, Math.max(1.5, l.size * v.k), false);
      ctx.restore();
    }
  }

  // ---------------- traços
  /** pressure: só da caneta (Apple Pencil); dedo e mouse ficam sem e a espessura segue a velocidade */
  /** último ponto bruto e pressão suavizada (estabilização do traço em andamento) */
  private sx = 0;
  private sy = 0;
  private sp = 0.5;
  private rx = 0;
  private ry = 0;
  /**
   * Começa um traço. `pressure` (Apple Pencil): a espessura varia de leve com ela (±25%), suavizada para
   * não oscilar; dedo e mouse ficam com espessura fixa.
   */
  /** tamanho de um ponto da tela em medidas do PDF, no zoom em que o traço é escrito (0 = desconhecido) */
  private unit = 0;
  begin(tool: 'pen' | 'marker', color: string, size: number, x: number, y: number, pressure?: number, unit = 0) {
    this.unit = unit;
    this.current = { id: newStrokeId(), tool, color, size, pts: [r4(x), r4(y)] };
    this.sx = this.rx = x;
    this.sy = this.ry = y;
    if (tool === 'pen' && pressure !== undefined) {
      this.sp = pressure;
      this.current.pr = [r2(pressure)];
    }
  }
  extend(x: number, y: number, pressure?: number) {
    const c = this.current;
    if (!c) return;
    // estabilização: o traço segue a ponta, mas cada ponto novo é puxado só 65% (tira o micro-tremor da mão
    // sem mudar a forma da letra)
    this.rx = x;
    this.ry = y;
    this.sx += (x - this.sx) * 0.65;
    this.sy += (y - this.sy) * 0.65;
    if (c.pr && pressure !== undefined) this.sp += (pressure - this.sp) * 0.25;
    const n = c.pts.length;
    // ignora pontos quase iguais (ruído do sensor)
    const min = Math.min(c.size * 0.1, 0.0005);
    if (Math.hypot(this.sx - c.pts[n - 2], this.sy - c.pts[n - 1]) < (this.unit ? Math.min(min, this.unit * 0.8) : min)) return;
    c.pts.push(r4(this.sx), r4(this.sy));
    if (c.pr) c.pr.push(r2(this.sp));
  }
  /** termina o traço; devolve o que mudou (para os outros aparelhos e para desfazer) */
  end(): InkOps | null {
    const c = this.current;
    this.current = null;
    if (!c) return null;
    // a caixa guardada durante o desenho só tinha o começo do traço
    this.boxes.delete(c);
    // a estabilização deixa o fim um pouco atrás da ponta: termina exatamente onde a caneta parou
    if (!c.shape && c.pts.length >= 4) {
      const n = c.pts.length;
      if (Math.hypot(this.rx - c.pts[n - 2], this.ry - c.pts[n - 1]) > 0.00005) {
        c.pts.push(r4(this.rx), r4(this.ry));
        if (c.pr) c.pr.push(r2(this.sp));
      }
    }
    // guarda a versão enxuta; o desenho aqui continua o do traço completo (não muda ao soltar)
    // alisa de leve (média com os vizinhos): tira o serrilhado que sobra do sensor sem mudar a letra
    if (!c.shape && c.pts.length >= 10) {
      const P = c.pts;
      const out = P.slice();
      for (let i = 2; i < P.length - 2; i++) out[i] = r4((P[i - 2] + 2 * P[i] + P[i + 2]) / 4);
      c.pts = out;
    }
    const lean = c.shape ? c : simplify(c, this.unit);
    this.list.push(lean);
    return { add: [lean] };
  }
  cancel() {
    this.current = null;
  }
  /** forma geométrica: começa num ponto e é refeita a cada movimento */
  beginShape(color: string, size: number, x: number, y: number, dash = false) {
    this.current = { id: newStrokeId(), tool: 'pen', color, size, pts: [r4(x), r4(y), r4(x), r4(y)], shape: true, ...(dash ? { dash: true } : {}) };
  }
  setShape(pts: number[]) {
    if (this.current?.shape) this.current.pts = pts.map(r4);
  }

  laser(id: string, color: string, size: number, x: number, y: number) {
    const l = this.lasers.get(id) ?? { color, size, pts: [], end: null };
    const n = l.pts.length;
    if (n && Math.hypot(x - l.pts[n - 2], y - l.pts[n - 1]) < size * 0.1) return;
    l.pts.push(x, y);
    l.end = null;
    this.lasers.set(id, l);
  }
  /** soltou: o laser começa a contar para sumir */
  laserEnd(id: string) {
    const l = this.lasers.get(id);
    if (l) l.end = performance.now();
  }
  /** laser vindo de outro aparelho: o traço até agora (some depois da última atualização) */
  laserFrom(id: string, color: string, pts: number[], size = 0.004) {
    this.lasers.set(id, { color, size, pts: [...pts], end: performance.now() });
  }

  /** borracha: apaga os traços tocados */
  erase(x: number, y: number, radius: number): string[] {
    const gone: string[] = [];
    const left = this.list.filter((s) => {
      const b = this.box(s);
      if (x < b.x0 - radius || x > b.x1 + radius || y < b.y0 - radius || y > b.y1 + radius) return true;
      const p = s.pts;
      const lim = radius + s.size / 2;
      let hit = p.length === 2 && Math.hypot(x - p[0], y - p[1]) < lim;
      for (let i = 2; !hit && i < p.length; i += 2) hit = segDist(x, y, p[i - 2], p[i - 1], p[i], p[i + 1]) < lim;
      if (hit) gone.push(s.id);
      return !hit;
    });
    // só troca a lista quando apagou algo (a imagem pronta da escrita continua valendo)
    if (gone.length) this.strokes = left;
    for (const id of gone) this.selected.delete(id);
    return gone;
  }

  // ---------------- seleção
  selectIn(x0: number, y0: number, x1: number, y1: number) {
    const [ax, bx] = x0 < x1 ? [x0, x1] : [x1, x0];
    const [ay, by] = y0 < y1 ? [y0, y1] : [y1, y0];
    this.selected = new Set(
      this.strokes
        .filter((s) => {
          for (let i = 0; i < s.pts.length; i += 2) if (s.pts[i] >= ax && s.pts[i] <= bx && s.pts[i + 1] >= ay && s.pts[i + 1] <= by) return true;
          return false;
        })
        .map((s) => s.id),
    );
    return this.selected.size;
  }
  /**
   * Seleção em laço (traço livre em volta da escrita): entra o traço que tem a maior parte dos pontos
   * dentro do laço. poly = x,y,x,y… em coordenadas do documento.
   */
  selectLasso(poly: number[]) {
    const n = poly.length / 2;
    if (n < 3) {
      this.selected = new Set();
      return 0;
    }
    const inside = (x: number, y: number) => {
      let c = false;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = poly[2 * i];
        const yi = poly[2 * i + 1];
        const xj = poly[2 * j];
        const yj = poly[2 * j + 1];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < poly.length; i += 2) {
      x0 = Math.min(x0, poly[i]);
      x1 = Math.max(x1, poly[i]);
      y0 = Math.min(y0, poly[i + 1]);
      y1 = Math.max(y1, poly[i + 1]);
    }
    this.selected = new Set(
      this.list
        .filter((s) => {
          const b = this.box(s);
          if (b.x1 < x0 || b.x0 > x1 || b.y1 < y0 || b.y0 > y1) return false;
          let k = 0;
          const m = s.pts.length / 2;
          for (let i = 0; i < s.pts.length; i += 2) if (inside(s.pts[i], s.pts[i + 1])) k++;
          return k >= Math.max(1, m * 0.5);
        })
        .map((s) => s.id),
    );
    return this.selected.size;
  }
  /** caixa em volta do que está selecionado */
  selectionBox(): Box | null {
    let b: Box | null = null;
    for (const s of this.strokes)
      if (this.selected.has(s.id)) {
        const c = this.box(s);
        b = b ? { x0: Math.min(b.x0, c.x0), y0: Math.min(b.y0, c.y0), x1: Math.max(b.x1, c.x1), y1: Math.max(b.y1, c.y1) } : { ...c };
      }
    return b;
  }
  /** move e/ou muda o tamanho do que está selecionado (escala em volta de ox,oy) */
  transform(dx: number, dy: number, scale = 1, ox = 0, oy = 0): InkOps | null {
    if (!this.selected.size) return null;
    const out: Stroke[] = [];
    this.strokes = this.strokes.map((s) => {
      if (!this.selected.has(s.id)) return s;
      const pts = s.pts.map((v, i) => r4(i % 2 === 0 ? ox + (v - ox) * scale + dx : oy + (v - oy) * scale + dy));
      const n: Stroke = { ...s, pts, size: s.size * scale };
      out.push(n);
      return n;
    });
    return { remove: out.map((s) => s.id), add: out };
  }

  // ---------------- mudanças vindas de outro aparelho / desfazer
  apply(ops: InkOps) {
    if (ops.remove?.length) {
      const rm = new Set(ops.remove);
      this.strokes = this.strokes.filter((s) => !rm.has(s.id));
    }
    if (ops.add?.length) {
      const byId = new Map(this.strokes.map((s, i) => [s.id, i]));
      for (const s of ops.add) {
        const i = byId.get(s.id);
        if (i === undefined) this.strokes.push(s);
        else this.strokes[i] = s;
      }
    }
    this.ver++;
  }
  /** o contrário de uma mudança (para desfazer) */
  invert(ops: InkOps, before: Stroke[]): InkOps {
    const prev = new Map(before.map((s) => [s.id, s]));
    const added = (ops.add ?? []).map((s) => s.id);
    const restored = [...new Set([...(ops.remove ?? []), ...added])].map((id) => prev.get(id)).filter((s): s is Stroke => Boolean(s));
    return { remove: added.filter((id) => !prev.has(id)), add: restored };
  }

  /** ids dos traços da página (de top até bottom, em coordenadas do documento) */
  idsInRange(top: number, bottom: number) {
    return this.strokes
      .filter((s) => {
        const b = this.box(s);
        const mid = (b.y0 + b.y1) / 2;
        return mid >= top && mid <= bottom;
      })
      .map((s) => s.id);
  }
}
