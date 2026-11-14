/**
 * Escrita por cima do PDF do estúdio (caneta, marca-texto, laser, borracha, formas e seleção).
 * O traço é o do motor "Traço" (lib/live/traco.ts): contorno preenchido, suavizado, com pressão e pontas
 * redondas. Aqui fica a adaptação ao estúdio: os traços acompanham o zoom, a rolagem e a troca de página do
 * PDF, são desenhados no quadro da live e viajam compactos entre os aparelhos e para o servidor.
 *
 * Por fora (quem usa esta classe), as medidas são em "larguras de página" (página = 1). Por dentro, os traços
 * ficam nas unidades do motor (página = 1000).
 */
import { HL_ALPHA, applyOp, bbox, eraseFrom, fillStroke, hitStroke, itemInLasso, r1, shapePoints, transformed, uid, type ShapeKind, type TShape, type TStroke } from './traco';

export type InkTool = 'hand' | 'pen' | 'marker' | 'laser' | 'eraser' | 'select' | 'shape';
export type { ShapeKind };
export type Stroke = TStroke;
export interface InkOps {
  add?: Stroke[];
  remove?: string[];
}
/**
 * Traço compacto (o que vai pela rede e fica guardado): pontos como diferenças pequenas num texto curto.
 * Um traço de 100 pontos ocupa ~300 bytes em vez de ~3 KB.
 */
export interface PackedStroke {
  id: string;
  tool: 'pen' | 'marker';
  color: string;
  /** espessura em larguras de página */
  size: number;
  /** pontos (x, y) */
  d: string;
  /** pressão em cada ponto (sem ela: 0,5) */
  p?: string;
  /** 1 = forma geométrica; 2 = forma pontilhada */
  s?: 1 | 2;
  /** precisão: 2 = centésimo de unidade do motor e pressão em centésimos; 1 = idem, pressão em 1/50; sem = antigo */
  q?: 1 | 2;
  /** forma pontilhada: quantos pontos do início são pontilhados (na seta, a ponta fica contínua) */
  n?: number;
}
export interface PackedOps {
  add?: PackedStroke[];
  remove?: string[];
}

/** unidades do motor por largura de página */
const U = 1000;

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
  const xy: number[] = [];
  const pr: number[] = [];
  let flat = true;
  for (let i = 0; i < s.p.length; i += 3) {
    xy.push(s.p[i], s.p[i + 1]);
    pr.push(s.p[i + 2]);
    if (s.p[i + 2] !== 0.5) flat = false;
  }
  const out: PackedStroke = { id: s.id, tool: s.t === 'hl' ? 'marker' : 'pen', color: s.c, size: Math.round((s.w / U) * 1e6) / 1e6, d: packSeq(xy, 100, 2), q: 2 };
  if (!flat) out.p = packSeq(pr, 100, 1);
  if (s.g) out.s = s.d ? 2 : 1;
  if (s.d && s.dn) out.n = s.dn;
  return out;
}
export function unpackStroke(x: PackedStroke | Stroke): Stroke | null {
  if (!x || typeof x.id !== 'string') return null;
  if ('k' in x && Array.isArray(x.p)) return x;
  const k = x as PackedStroke;
  if (typeof k.d !== 'string') return null;
  // antigos: décimo de milésimo da página (= décimo de unidade); novos: centésimo de unidade
  const xy = unpackSeq(k.d, k.q ? 100 : 10, 2);
  if (xy.length < 2) return null;
  if (xy.length % 2) xy.pop();
  const n = xy.length / 2;
  let pr: number[] | null = null;
  if (typeof k.p === 'string') {
    pr = unpackSeq(k.p, k.q === 2 ? 100 : 50, 1);
    if (pr.length !== n) pr = null;
  }
  const p: number[] = [];
  for (let i = 0; i < n; i++) p.push(xy[2 * i], xy[2 * i + 1], pr ? Math.min(1, Math.max(0, pr[i])) : 0.5);
  const s: Stroke = { id: k.id, k: 's', t: k.tool === 'marker' ? 'hl' : 'pen', c: k.color, w: Math.max(0.05, (Number(k.size) || 0.003) * U), p };
  if (k.s === 1 || k.s === 2) s.g = 1;
  if (k.s === 2) {
    s.d = 1;
    if (typeof k.n === 'number' && k.n >= 2 && k.n < n) s.dn = Math.round(k.n);
  }
  return s;
}
export const packOps = (o: InkOps): PackedOps => ({ ...(o.add ? { add: o.add.map(packStroke) } : {}), ...(o.remove ? { remove: o.remove } : {}) });
export const unpackOps = (o: PackedOps | InkOps): InkOps => ({
  ...(o.add ? { add: (o.add as (PackedStroke | Stroke)[]).map(unpackStroke).filter((s): s is Stroke => Boolean(s)) } : {}),
  ...(o.remove ? { remove: o.remove } : {}),
});

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

const LASER_HOLD = 2000; // o laser fica na tela por 2 s depois de parar
const LASER_FADE = 450; // e então some suavemente

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const newStrokeId = uid;

type Box = { x0: number; y0: number; x1: number; y1: number };
/** o que a borracha tirou e deixou durante um gesto (para gravar e desfazer de uma vez) */
export interface EraseAcc {
  del: Map<string, Stroke>;
  put: Map<string, Stroke>;
}
/** mover (dx, dy), redimensionar (k, em volta de ox, oy) e girar (rot, em volta de ox, oy): em larguras de página */
export interface InkMove {
  dx?: number;
  dy?: number;
  k?: number;
  rot?: number;
  ox?: number;
  oy?: number;
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
  /** lasers: riscos que somem sozinhos depois de soltar (`end`) */
  lasers = new Map<string, { color: string; size: number; pts: number[]; end: number | null }>();
  selected = new Set<string>();

  /** versão dos traços: muda a cada alteração (quem guarda a escrita pronta como imagem refaz só nessa hora) */
  get version() {
    return this.ver;
  }
  /** quantos traços há (traços de caneta novos entram no fim sem mudar a versão) */
  get count() {
    return this.list.length;
  }
  /** há algo se mexendo (traço sendo escrito ou laser sumindo): desenhado a cada quadro */
  get busy() {
    return Boolean(this.current || this.lasers.size);
  }

  // ---------------- desenho
  /** passa a desenhar nas unidades do motor */
  private enter(ctx: CanvasRenderingContext2D, v: InkView) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(v.x, v.y, v.w, v.h);
    ctx.clip();
    ctx.translate(v.x - v.cx * v.k, v.y - v.cy * v.k);
    ctx.scale(v.k / U, v.k / U);
  }
  private seen(s: Stroke, v: InkView) {
    const b = bbox(s);
    return !(b[2] < v.cx * U || b[0] > (v.cx + v.w / v.k) * U || b[3] < v.cy * U || b[1] > (v.cy + v.h / v.k) * U);
  }

  /** camada de rascunho do marca-texto (reaproveitada) */
  private scratch: HTMLCanvasElement | null = null;
  /**
   * Marca-texto: pintado opaco numa camada à parte e só então aplicado com transparência (como no motor):
   * onde um destaque passa por cima de outro, ou de si mesmo, a cor fica por igual.
   */
  private drawMarkers(ctx: CanvasRenderingContext2D, v: InkView, extra?: TShape & { c: string }) {
    // (com `extra`, só o destaque em andamento: os prontos já estão na imagem)
    const vis = extra ? [] : this.list.filter((s) => s.t === 'hl' && this.seen(s, v));
    if (!vis.length && !extra) return;
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const layer = (this.scratch ??= document.createElement('canvas'));
    if (layer.width !== W || layer.height !== H) {
      layer.width = W;
      layer.height = H;
    }
    const g = layer.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    g.setTransform(ctx.getTransform());
    this.enter(g, v);
    for (const s of vis) {
      g.fillStyle = s.c;
      fillStroke(g, s);
    }
    if (extra) {
      g.fillStyle = extra.c;
      fillStroke(g, extra);
    }
    g.restore();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = HL_ALPHA;
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
  }

  /** só a caneta e as formas, a partir de `from` (camada nítida do aparelho que escreve; fim da imagem pronta) */
  drawPens(ctx: CanvasRenderingContext2D, v: InkView, _exact = true, from = 0) {
    this.enter(ctx, v);
    for (let i = from; i < this.list.length; i++) {
      const s = this.list[i];
      if (s.t !== 'pen' || !this.seen(s, v)) continue;
      ctx.fillStyle = s.c;
      fillStroke(ctx, s);
    }
    ctx.restore();
  }
  /** desenha só os traços a partir de `from` (acrescenta à imagem pronta, sem redesenhar a página) */
  drawTail(ctx: CanvasRenderingContext2D, v: InkView, from: number) {
    this.drawPens(ctx, v, true, from);
  }
  /** escrita terminada: marca-texto por baixo da caneta (a letra fica por cima do destaque) */
  drawDoneAll(ctx: CanvasRenderingContext2D, v: InkView, _exact = true) {
    if (!this.list.length) return;
    this.drawMarkers(ctx, v);
    this.drawPens(ctx, v);
  }

  /** o traço em andamento, pronto para desenhar (o contorno só é refeito quando chegam pontos novos) */
  private liveShape: (TShape & { c: string }) | null = null;
  private liveKey: number[] | null = null;
  private liveLen = -1;
  private live() {
    const c = this.current;
    if (!c || !c.p.length) return null;
    if (this.liveKey !== c.p || this.liveLen !== c.p.length) {
      this.liveKey = c.p;
      this.liveLen = c.p.length;
      this.liveShape = { t: c.t, w: c.w, p: c.p, g: c.g, d: c.d, dn: c.dn, c: c.c };
    }
    return this.liveShape;
  }
  /** só a caneta/forma em andamento (camada rápida do aparelho que escreve) */
  drawCurrentPen(ctx: CanvasRenderingContext2D, v: InkView) {
    const s = this.live();
    if (!s || s.t !== 'pen') return;
    this.enter(ctx, v);
    ctx.fillStyle = s.c;
    fillStroke(ctx, s);
    ctx.restore();
  }
  /** o que muda a cada quadro: traço em andamento e laser */
  drawLive(ctx: CanvasRenderingContext2D, v: InkView) {
    const s = this.live();
    if (s?.t === 'pen') this.drawCurrentPen(ctx, v);
    else if (s) this.drawMarkers(ctx, v, s);
    if (this.lasers.size) this.drawLasers(ctx, v);
  }
  draw(ctx: CanvasRenderingContext2D, v: InkView) {
    this.drawDoneAll(ctx, v);
    this.drawLive(ctx, v);
  }

  /** risco liso por todos os pontos (laser) */
  private strokeCurve(ctx: CanvasRenderingContext2D, p: number[], v: InkView, lw: number) {
    const n = p.length / 2;
    if (n < 1) return;
    const X = (i: number) => v.x + (p[2 * Math.min(n - 1, Math.max(0, i))] - v.cx) * v.k;
    const Y = (i: number) => v.y + (p[2 * Math.min(n - 1, Math.max(0, i)) + 1] - v.cy) * v.k;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(X(0), Y(0));
    if (n === 1) ctx.lineTo(X(0) + 0.01, Y(0));
    for (let i = 0; i < n - 1; i++) {
      const c1x = X(i) + (X(i + 1) - X(i - 1)) / 6;
      const c1y = Y(i) + (Y(i + 1) - Y(i - 1)) / 6;
      const c2x = X(i + 1) - (X(i + 2) - X(i)) / 6;
      const c2y = Y(i + 1) - (Y(i + 2) - Y(i)) / 6;
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, X(i + 1), Y(i + 1));
    }
    ctx.stroke();
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
      this.strokeCurve(ctx, l.pts, v, Math.max(1.5, l.size * v.k));
      ctx.restore();
    }
  }

  // ---------------- traços (captura como no motor: filtro leve, espaçamento mínimo e pressão suavizada)
  private act: { isPen: boolean; lx: number; ly: number; fx: number; fy: number; rx: number; ry: number; pr: number; lt: number; vs: number } | null = null;
  /**
   * Começa um traço. `pen`: veio de uma caneta (Apple Pencil) — a espessura segue a pressão; com dedo ou mouse
   * a pressão é simulada pela velocidade (rápido = mais fino). `unit`: tamanho de um ponto da tela em larguras
   * de página, no zoom atual. `t`: horário do evento (ms).
   */
  begin(tool: 'pen' | 'marker', color: string, size: number, x: number, y: number, o: { pressure?: number; pen?: boolean; unit?: number; t?: number } = {}) {
    const isPen = Boolean(o.pen);
    const t = tool === 'marker' ? 'hl' : 'pen';
    const px = x * U;
    const py = y * U;
    const pr = t === 'hl' ? 0.5 : isPen ? clamp(o.pressure || 0.2, 0.05, 1) : 0.5;
    this.current = { id: uid(), k: 's', t, c: color, w: Math.max(0.05, size * U), p: [r1(px), r1(py), pr] };
    this.act = { isPen, lx: px, ly: py, fx: px, fy: py, rx: px, ry: py, pr, lt: o.t ?? performance.now(), vs: o.unit ? 1 / (o.unit * U) : 1 };
    this.shape0 = null;
  }
  extend(x: number, y: number, pressure = 0, t = performance.now()) {
    const c = this.current;
    const a = this.act;
    if (!c || !a || c.g) return;
    const px = x * U;
    const py = y * U;
    // A caneta manda a posição centenas de vezes por segundo, com um tremor fino. Um filtro leve (que quase
    // não atrasa) e um espaçamento mínimo entre pontos deixam o traço liso.
    const minD = Math.max((a.isPen ? 1.1 : 0.8) / a.vs, c.w * 0.1);
    const k = a.isPen ? 0.5 : 0.75;
    a.rx = px;
    a.ry = py;
    a.fx += (px - a.fx) * k;
    a.fy += (py - a.fy) * k;
    if (c.t === 'pen' && a.isPen) {
      const raw = pressure > 0 ? pressure : a.pr;
      a.pr += (raw - a.pr) * 0.3; // pressão também suavizada
    }
    const d = Math.hypot(a.fx - a.lx, a.fy - a.ly);
    if (d < minD) return;
    let pr = 0.5;
    if (c.t === 'pen') {
      if (!a.isPen) {
        // sem caneta: simula a pressão pela velocidade (rápido = mais fino)
        const dt = Math.max(1, t - a.lt);
        const speed = (d * a.vs) / dt;
        a.pr += (clamp(0.62 - speed * 0.16, 0.3, 0.62) - a.pr) * 0.2;
      }
      pr = a.pr;
    }
    a.lx = a.fx;
    a.ly = a.fy;
    a.lt = t;
    c.p.push(r1(a.fx), r1(a.fy), Math.round(pr * 100) / 100);
  }
  /** termina o traço; devolve o que mudou (para os outros aparelhos e para desfazer) */
  end(): InkOps | null {
    const c = this.current;
    const a = this.act;
    this.current = null;
    this.act = null;
    if (!c) return null;
    if (c.g) {
      this.shape0 = null;
      if (c.p.length < 6) return null;
    } else if (a && Math.hypot(a.rx - a.lx, a.ry - a.ly) > 0.3 / a.vs) {
      // termina exatamente onde a ponta parou
      c.p.push(r1(a.rx), r1(a.ry), c.t === 'pen' ? Math.round(a.pr * 100) / 100 : 0.5);
    }
    // o contorno do traço pronto é calculado uma vez e reaproveitado
    const done: Stroke = { ...c };
    this.list.push(done);
    // o marca-texto é refeito inteiro (as cores se misturam por igual); a caneta só entra no fim da imagem pronta
    if (done.t === 'hl') this.ver++;
    return { add: [done] };
  }
  cancel() {
    this.current = null;
    this.act = null;
    this.shape0 = null;
  }

  // ---------------- formas
  private shape0: { x: number; y: number; x1: number; y1: number } | null = null;
  /** forma geométrica: começa num ponto e é refeita a cada movimento */
  beginShape(color: string, size: number, x: number, y: number, dash = false) {
    this.current = { id: uid(), k: 's', t: 'pen', g: 1, c: color, w: Math.max(0.05, size * U), p: [], ...(dash ? { d: 1 as const } : {}) };
    this.act = null;
    this.shape0 = { x: x * U, y: y * U, x1: x * U, y1: y * U };
  }
  setShape(kind: ShapeKind, x: number, y: number) {
    const c = this.current;
    const o = this.shape0;
    if (!c?.g || !o) return;
    o.x1 = x * U;
    o.y1 = y * U;
    const pts = shapePoints(kind, o.x, o.y, o.x1, o.y1, c.w);
    c.p = pts;
    // na seta pontilhada, a ponta fica contínua
    if (c.d && pts.shaft) c.dn = pts.shaft;
    else delete c.dn;
  }
  /** tamanho da forma em andamento (larguras de página): toque sem arrastar não vira forma */
  shapeSpan() {
    const o = this.shape0;
    return o ? Math.max(Math.abs(o.x1 - o.x), Math.abs(o.y1 - o.y)) / U : 0;
  }

  // ---------------- laser
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

  // ---------------- borracha
  /**
   * Borracha num ponto. `part`: apaga só o pedaço tocado (o que sobra do traço vira pedaços novos); senão,
   * o traço inteiro. `acc` junta o que saiu e o que entrou durante o gesto. Devolve se apagou algo.
   */
  erase(x: number, y: number, radius: number, part: boolean, acc: EraseAcc) {
    const px = x * U;
    const py = y * U;
    const r = radius * U;
    let del: Stroke[] | null = null;
    let put: Stroke[] | null = null;
    for (const it of this.list) {
      if (part) {
        const pieces = eraseFrom(it, px, py, r);
        if (!pieces) continue;
        (del ??= []).push(it);
        if (pieces.length) (put ??= []).push(...pieces);
      } else if (hitStroke(it, px, py, r)) (del ??= []).push(it);
    }
    if (!del) return false;
    this.strokes = applyOp(
      this.list,
      del.map((d) => d.id),
      put ?? undefined,
    );
    for (const d of del) {
      this.selected.delete(d.id);
      if (acc.put.has(d.id)) acc.put.delete(d.id);
      else acc.del.set(d.id, d);
    }
    for (const n of put ?? []) acc.put.set(n.id, n);
    return true;
  }
  /** borracha arrastada de um ponto a outro (sem pular nada no caminho) */
  eraseLine(x0: number, y0: number, x1: number, y1: number, radius: number, part: boolean, acc: EraseAcc) {
    const d = Math.hypot(x1 - x0, y1 - y0) * U;
    const n = Math.max(1, Math.ceil(d / Math.max(2, (radius * U) / 2)));
    let any = false;
    for (let i = 1; i <= n; i++) if (this.erase(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, radius, part, acc)) any = true;
    return any;
  }

  // ---------------- seleção (laço)
  /** entra o traço que tem a maior parte dentro do laço. poly = x,y,x,y… em larguras de página */
  selectLasso(poly: number[]) {
    if (poly.length < 8) {
      this.selected = new Set();
      return 0;
    }
    const q = poly.map((v) => v * U);
    this.selected = new Set(this.list.filter((s) => itemInLasso(s, q)).map((s) => s.id));
    return this.selected.size;
  }
  selectedStrokes() {
    return this.list.filter((s) => this.selected.has(s.id));
  }
  /** caixa em volta do que está selecionado */
  selectionBox(): Box | null {
    let b: [number, number, number, number] | null = null;
    for (const s of this.list)
      if (this.selected.has(s.id)) {
        const c = bbox(s);
        b = b ? [Math.min(b[0], c[0]), Math.min(b[1], c[1]), Math.max(b[2], c[2]), Math.max(b[3], c[3])] : [c[0], c[1], c[2], c[3]];
      }
    return b ? { x0: (b[0] - 6) / U, y0: (b[1] - 6) / U, x1: (b[2] + 6) / U, y1: (b[3] + 6) / U } : null;
  }
  /**
   * Move, gira e redimensiona de uma vez os traços `base` (como estavam quando o gesto começou): durante o
   * gesto a conta é sempre refeita a partir deles, sem acumular arredondamento. Devolve os traços novos.
   */
  retransform(base: Stroke[], m: InkMove): Stroke[] {
    const mm = { k: m.k, rot: m.rot, ox: (m.ox ?? 0) * U, oy: (m.oy ?? 0) * U, dx: (m.dx ?? 0) * U, dy: (m.dy ?? 0) * U };
    const next = base.map((s) => transformed(s, mm));
    const byId = new Map(next.map((s) => [s.id, s]));
    this.strokes = this.list.map((s) => byId.get(s.id) ?? s);
    return next;
  }

  // ---------------- mudanças vindas de outro aparelho / desfazer
  apply(ops: InkOps) {
    this.strokes = applyOp(this.list, ops.remove, ops.add);
  }
  /** o contrário de uma mudança (para desfazer) */
  invert(ops: InkOps, before: Stroke[]): InkOps {
    const prev = new Map(before.map((s) => [s.id, s]));
    const added = (ops.add ?? []).map((s) => s.id);
    const restored = [...new Set([...(ops.remove ?? []), ...added])].map((id) => prev.get(id)).filter((s): s is Stroke => Boolean(s));
    return { remove: added.filter((id) => !prev.has(id)), add: restored };
  }

  /** ids dos traços da página (de top até bottom, em larguras de página) */
  idsInRange(top: number, bottom: number) {
    return this.list
      .filter((s) => {
        const b = bbox(s);
        const mid = (b[1] + b[3]) / 2 / U;
        return mid >= top && mid <= bottom;
      })
      .map((s) => s.id);
  }
}
