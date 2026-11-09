/**
 * Escrita por cima do PDF do estúdio (caneta, marca-texto, laser, borracha e seleção).
 * Os traços ficam guardados nas coordenadas do documento (largura da página = 1), então acompanham
 * o zoom, a rolagem e a troca de página, e são redesenhados na resolução da live (sem pixelar).
 */
import { getStroke } from 'perfect-freehand';

export type InkTool = 'hand' | 'pen' | 'marker' | 'laser' | 'eraser' | 'select';

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
  const p: PackedStroke = { id: s.id, tool: s.tool, color: s.color, size: Math.round(s.size * 1e6) / 1e6, d: packSeq(s.pts, 10000, 2) };
  if (s.pr) p.p = packSeq(s.pr, 50, 1);
  return p;
}
export function unpackStroke(x: PackedStroke | Stroke): Stroke | null {
  if (!x || typeof x.id !== 'string') return null;
  if ('pts' in x && Array.isArray(x.pts)) return x;
  const k = x as PackedStroke;
  if (typeof k.d !== 'string') return null;
  const pts = unpackSeq(k.d, 10000, 2);
  if (pts.length < 2) return null;
  if (pts.length % 2) pts.pop();
  const s: Stroke = { id: k.id, tool: k.tool === 'marker' ? 'marker' : 'pen', color: k.color, size: k.size, pts };
  if (typeof k.p === 'string') {
    const pr = unpackSeq(k.p, 50, 1);
    if (pr.length === pts.length / 2) s.pr = pr;
  }
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
function simplify(s: Stroke): Stroke {
  const n = s.pts.length / 2;
  if (n < 3) return s;
  const eps = s.size * 0.06;
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

const LASER_HOLD = 900; // ms parado antes de começar a sumir
const LASER_FADE = 900; // ms sumindo

const r4 = (n: number) => Math.round(n * 10000) / 10000;
const r2 = (n: number) => Math.round(n * 50) / 50;
/** o contorno é calculado com a página = 1000 unidades (as medidas internas da biblioteca são em "pixels") */
const U = 1000;

/**
 * Contorno da caneta (tinta que desliza): espessura pela pressão da Apple Pencil (ou pela velocidade),
 * curva suavizada e pontas arredondadas. Devolve x,y,x,y… em coordenadas do documento.
 */
function penOutline(s: Stroke, done: boolean): number[] {
  const n = s.pts.length / 2;
  const hasPr = Boolean(s.pr && s.pr.length === n);
  const input: number[][] = new Array(n);
  for (let i = 0; i < n; i++) input[i] = [s.pts[2 * i] * U, s.pts[2 * i + 1] * U, hasPr ? s.pr![i] : 0.5];
  const out = getStroke(input, {
    size: s.size * U,
    thinning: hasPr ? 0.6 : 0,
    smoothing: 0.62,
    streamline: 0.32,
    simulatePressure: false,
    start: { cap: true },
    end: { cap: true },
    last: done,
  });
  const flat = new Array(out.length * 2);
  for (let i = 0; i < out.length; i++) {
    flat[2 * i] = out[i][0] / U;
    flat[2 * i + 1] = out[i][1] / U;
  }
  return flat;
}
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
  /** contorno do traço em andamento (a live e a camada rápida usam o mesmo, sem recalcular) */
  private liveO: { s: Stroke; n: number; p: number; o: number[] } | null = null;
  /** traço sendo desenhado agora */
  current: Stroke | null = null;
  /** lasers: pontos com o momento em que foram feitos (somem sozinhos) */
  lasers = new Map<string, { color: string; pts: { x: number; y: number; t: number }[] }>();
  selected = new Set<string>();
  private boxes = new WeakMap<Stroke, Box>();
  /** contorno pronto de cada traço terminado (não recalcula a cada quadro) */
  private outlines = new WeakMap<Stroke, number[]>();

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
  private drawDone(ctx: CanvasRenderingContext2D, v: InkView, tool: 'pen' | 'marker') {
    const vx0 = v.cx;
    const vy0 = v.cy;
    const vx1 = v.cx + v.w / v.k;
    const vy1 = v.cy + v.h / v.k;
    let any = false;
    for (const s of this.list) {
      if (s.tool !== tool) continue;
      const b = this.box(s);
      if (b.x1 < vx0 || b.x0 > vx1 || b.y1 < vy0 || b.y0 > vy1) continue;
      this.drawStroke(ctx, s, v, false);
      any = true;
    }
    return any;
  }

  /** versão dos traços: muda a cada alteração (quem guarda a escrita pronta como imagem refaz só nessa hora) */
  get version() {
    return this.ver;
  }
  /** há algo se mexendo (traço sendo escrito ou laser sumindo): desenhado a cada quadro */
  get busy() {
    return Boolean(this.current || this.lasers.size);
  }

  /** escrita terminada: marca-texto por baixo da caneta (a letra fica por cima do destaque) */
  drawDoneAll(ctx: CanvasRenderingContext2D, v: InkView) {
    if (!this.list.length) return;
    this.drawDone(ctx, v, 'marker');
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
  drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, v: InkView, live = s === this.current) {
    if (s.tool === 'pen') this.fillPen(ctx, s, v, live);
    else this.path(ctx, s, v);
  }

  private fillPen(ctx: CanvasRenderingContext2D, s: Stroke, v: InkView, live: boolean) {
    let o: number[];
    if (!live) {
      o = this.outlines.get(s) ?? penOutline(s, true);
      this.outlines.set(s, o);
    } else {
      // traço em andamento: só recalcula quando chega ponto novo
      const n = s.pts.length;
      const p = s.pr ? s.pr[s.pr.length - 1] : 0;
      const c = this.liveO;
      if (c && c.s === s && c.n === n && c.p === p) o = c.o;
      else {
        o = penOutline(s, false);
        // a cópia com os pontos previstos (camada rápida) não ocupa o lugar do traço de verdade
        if (s === this.current) this.liveO = { s, n, p, o };
      }
    }
    const m = o.length / 2;
    if (m < 3) return;
    const X = (i: number) => v.x + (o[2 * (i % m)] - v.cx) * v.k;
    const Y = (i: number) => v.y + (o[2 * (i % m) + 1] - v.cy) * v.k;
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.moveTo((X(0) + X(1)) / 2, (Y(0) + Y(1)) / 2);
    // contorno liso: curva pelos pontos médios
    for (let i = 1; i <= m; i++) ctx.quadraticCurveTo(X(i), Y(i), (X(i) + X(i + 1)) / 2, (Y(i) + Y(i + 1)) / 2);
    ctx.closePath();
    ctx.fill();
  }

  private path(ctx: CanvasRenderingContext2D, s: Stroke, v: InkView) {
    const p = s.pts;
    if (p.length < 2) return;
    const X = (i: number) => v.x + (p[i] - v.cx) * v.k;
    const Y = (i: number) => v.y + (p[i + 1] - v.cy) * v.k;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = s.color;
    ctx.lineWidth = Math.max(1, s.size * v.k);
    if (s.tool === 'marker') {
      ctx.globalAlpha = 0.38;
      ctx.globalCompositeOperation = 'multiply';
    }
    ctx.beginPath();
    ctx.moveTo(X(0), Y(0));
    if (p.length === 2) ctx.lineTo(X(0) + 0.01, Y(0));
    // curva suave passando pelos pontos médios (letra sem "quinas")
    for (let i = 2; i < p.length - 2; i += 2) ctx.quadraticCurveTo(X(i), Y(i), (X(i) + X(i + 2)) / 2, (Y(i) + Y(i + 2)) / 2);
    if (p.length > 2) ctx.lineTo(X(p.length - 2), Y(p.length - 2));
    ctx.stroke();
    ctx.restore();
  }

  private drawLasers(ctx: CanvasRenderingContext2D, v: InkView) {
    const now = performance.now();
    for (const [id, l] of this.lasers) {
      l.pts = l.pts.filter((q) => now - q.t < LASER_HOLD + LASER_FADE);
      if (!l.pts.length) {
        this.lasers.delete(id);
        continue;
      }
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = l.color;
      ctx.shadowBlur = Math.max(6, v.k * 0.012);
      for (let i = 1; i < l.pts.length; i++) {
        const a = l.pts[i - 1];
        const b = l.pts[i];
        const age = now - b.t;
        ctx.globalAlpha = age < LASER_HOLD ? 1 : Math.max(0, 1 - (age - LASER_HOLD) / LASER_FADE);
        ctx.strokeStyle = l.color;
        ctx.lineWidth = Math.max(3, v.k * 0.006);
        ctx.beginPath();
        ctx.moveTo(v.x + (a.x - v.cx) * v.k, v.y + (a.y - v.cy) * v.k);
        ctx.lineTo(v.x + (b.x - v.cx) * v.k, v.y + (b.y - v.cy) * v.k);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ---------------- traços
  /** pressure: só da caneta (Apple Pencil); dedo e mouse ficam sem e a espessura segue a velocidade */
  begin(tool: 'pen' | 'marker', color: string, size: number, x: number, y: number, pressure?: number) {
    this.current = { id: newStrokeId(), tool, color, size, pts: [r4(x), r4(y)] };
    if (tool === 'pen' && pressure !== undefined) this.current.pr = [r2(pressure)];
  }
  extend(x: number, y: number, pressure?: number) {
    const c = this.current;
    if (!c) return;
    const n = c.pts.length;
    // ignora pontos quase iguais (menos dados; a curva continua lisa)
    if (Math.hypot(x - c.pts[n - 2], y - c.pts[n - 1]) < c.size * 0.1) {
      // mesma posição, pressão maior: guarda a maior (ponto que "engorda" ao apertar)
      if (c.pr && pressure !== undefined && pressure > c.pr[c.pr.length - 1]) c.pr[c.pr.length - 1] = r2(pressure);
      return;
    }
    c.pts.push(r4(x), r4(y));
    if (c.pr) c.pr.push(r2(pressure ?? c.pr[c.pr.length - 1]));
  }
  /** termina o traço; devolve o que mudou (para os outros aparelhos e para desfazer) */
  end(): InkOps | null {
    const c = this.current;
    this.current = null;
    if (!c) return null;
    // a caixa guardada durante o desenho só tinha o começo do traço
    this.boxes.delete(c);
    this.liveO = null;
    // guarda a versão enxuta; o desenho aqui continua o do traço completo (não muda ao soltar)
    const lean = simplify(c);
    if (c.tool === 'pen') this.outlines.set(lean, penOutline(c, true));
    this.list.push(lean);
    this.ver++;
    return { add: [lean] };
  }
  cancel() {
    this.current = null;
  }

  laser(id: string, color: string, x: number, y: number) {
    const l = this.lasers.get(id) ?? { color, pts: [] };
    l.pts.push({ x, y, t: performance.now() });
    this.lasers.set(id, l);
  }
  /** laser vindo de outro aparelho: todos os pontos "agora" (somem juntos depois) */
  laserFrom(id: string, color: string, pts: number[]) {
    const t = performance.now();
    const l = { color, pts: [] as { x: number; y: number; t: number }[] };
    for (let i = 0; i < pts.length; i += 2) l.pts.push({ x: pts[i], y: pts[i + 1], t });
    this.lasers.set(id, l);
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
