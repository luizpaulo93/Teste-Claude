/**
 * Motor de escrita "Traço" (geometria da tinta), trazido do app de caderno do professor.
 * O traço vira um contorno preenchido: linha central suavizada, espessura pela pressão, pontas e cantos
 * sempre arredondados, pontilhado, formas, borracha parcial, laço e mover/girar/redimensionar.
 *
 * Traço: { id, k:'s', t:'pen'|'hl', c:'#rrggbb', w:espessura, p:[x,y,pressão, ...] }
 * Coordenadas em unidades de página: a largura da página tem 1000 unidades.
 */

const TAU = Math.PI * 2;

export interface TStroke {
  id: string;
  k: 's';
  t: 'pen' | 'hl';
  c: string;
  /** espessura em unidades de página */
  w: number;
  /** x, y, pressão, x, y, pressão… */
  p: number[];
  /** forma geométrica (cantos vivos) */
  g?: 1;
  /** pontilhado */
  d?: 1;
  /** quantos pontos do início são pontilhados (na seta, a ponta fica contínua) */
  dn?: number;
}
/** o que basta para desenhar (o traço em andamento ainda não tem id) */
export type TShape = Pick<TStroke, 't' | 'w' | 'p' | 'g' | 'd' | 'dn'>;
export type InkPath = Path2D & { caps?: Path2D };
export type TBox = [number, number, number, number];
export interface TMove {
  k?: number;
  rot?: number;
  ox?: number;
  oy?: number;
  dx?: number;
  dy?: number;
}

const pathCache = new WeakMap<object, InkPath>();
const boxCache = new WeakMap<object, TBox>();

export function uid() {
  const a = new Uint8Array(9);
  crypto.getRandomValues(a);
  let s = '';
  for (const b of a) s += b.toString(36).padStart(2, '0');
  return s.slice(0, 12);
}

export function radiusAt(s: TShape, i: number) {
  const half = s.w / 2;
  if (s.t !== 'pen') return half;
  const pr = s.p[i * 3 + 2];
  return half * (0.7 + 0.6 * pr); // a pressão engrossa ou afina, sem exagero
}

// Linha central suavizada: tira o tremor fino da caneta (que amostra a posição centenas de vezes por
// segundo) sem mudar o desenho. Formas geométricas (s.g) ficam como estão, com cantos vivos.
function centerline(s: TShape) {
  const p = s.p;
  const n = p.length / 3;
  const X = new Float64Array(n);
  const Y = new Float64Array(n);
  const R = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    X[i] = p[i * 3];
    Y[i] = p[i * 3 + 1];
    R[i] = radiusAt(s, i);
  }
  if (s.g || n < 3) return { X, Y, R, n };
  for (let pass = 0; pass < 2; pass++) {
    let px = X[0];
    let py = Y[0];
    let pr = R[0];
    for (let i = 1; i < n - 1; i++) {
      const cx = X[i];
      const cy = Y[i];
      const cr = R[i];
      X[i] = (px + 2 * cx + X[i + 1]) / 4;
      Y[i] = (py + 2 * cy + Y[i + 1]) / 4;
      R[i] = (pr + 2 * cr + R[i + 1]) / 4;
      px = cx;
      py = cy;
      pr = cr;
    }
  }
  return { X, Y, R, n };
}

// Contorno do traço: um polígono que acompanha a linha central com a espessura variando conforme a
// pressão, com pontas arredondadas. Devolve também `joints`: pontos onde a linha dá meia-volta ou faz um
// canto, que recebem um círculo para o traço ficar sempre boleado.
function outline(s: TShape) {
  const { X, Y, R, n } = centerline(s);
  const left: number[] = [];
  const right: number[] = [];
  const joints: [number, number, number][] = [];
  let tx = 1;
  let ty = 0;
  let lastLx = NaN;
  let lastLy = NaN;
  let lastRx = NaN;
  let lastRy = NaN;
  const minD2 = Math.max(0.04, (s.w * 0.08) ** 2);

  // comprimento acumulado ao longo da linha
  const cum = new Float64Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]);

  // direção inicial: a do traço inteiro (vale para risquinhos bem curtos)
  const ol = Math.hypot(X[n - 1] - X[0], Y[n - 1] - Y[0]);
  if (ol > 1e-6) {
    tx = (X[n - 1] - X[0]) / ol;
    ty = (Y[n - 1] - Y[0]) / ol;
  }

  let a = 0;
  let b = 0;
  let lastJoint = -1;
  for (let i = 0; i < n; i++) {
    const x = X[i];
    const y = Y[i];
    const r = R[i];
    // A direção é medida numa janela proporcional à espessura. Com pontos muito juntos (zoom alto, caneta
    // devagar) e traço grosso, uma janela pequena faz a borda "dançar" e a ponta sair quadrada.
    const reach = s.g ? 0 : Math.max(1, r * 0.7);
    while (a < i - 1 && cum[i] - cum[a + 1] >= reach) a++;
    if (a > i - 1) a = Math.max(i - 1, 0);
    if (b < i + 1) b = Math.min(i + 1, n - 1);
    while (b < n - 1 && cum[b] - cum[i] < reach) b++;
    const ia = Math.min(a, Math.max(i - 1, 0));
    const dx = X[b] - X[ia];
    const dy = Y[b] - Y[ia];
    const len = Math.hypot(dx, dy);
    if (len > Math.max(1e-6, reach * 0.25)) {
      tx = dx / len;
      ty = dy / len;
    }

    // meia-volta ou canto: marca para receber um círculo
    if (i > 0 && i < n - 1) {
      const d1x = x - X[ia];
      const d1y = y - Y[ia];
      const d2x = X[b] - x;
      const d2y = Y[b] - y;
      const l1 = Math.hypot(d1x, d1y);
      const l2 = Math.hypot(d2x, d2y);
      if (l1 > 1e-6 && l2 > 1e-6 && (d1x * d2x + d1y * d2y) / (l1 * l2) < 0.5) {
        const q = lastJoint < 0 ? null : joints[joints.length - 1];
        if (!q || Math.hypot(x - q[0], y - q[1]) > r * 0.35) {
          joints.push([x, y, r]);
          lastJoint = i;
        }
      }
    }

    const nx = -ty * r;
    const ny = tx * r;
    const lx = x - nx;
    const ly = y - ny;
    const rx = x + nx;
    const ry = y + ny;
    const end = i === n - 1;
    if (end || !((lx - lastLx) ** 2 + (ly - lastLy) ** 2 < minD2)) {
      left.push(lx, ly);
      lastLx = lx;
      lastLy = ly;
    }
    if (end || !((rx - lastRx) ** 2 + (ry - lastRy) ** 2 < minD2)) {
      right.push(rx, ry);
      lastRx = rx;
      lastRy = ry;
    }
  }
  joints.push([X[0], Y[0], R[0]], [X[n - 1], Y[n - 1], R[n - 1]]);
  return { left, right, joints };
}

// Corta a linha em trechos "ligados" de comprimento `dash`, separados por `gap`.
function dashRuns(p: number[], count: number, dash: number, gap: number) {
  const runs: number[][] = [];
  let on = true;
  let left = dash;
  let cur = [p[0], p[1], p[2]];
  for (let i = 1; i < count; i++) {
    const ax = p[i * 3 - 3];
    const ay = p[i * 3 - 2];
    const bx = p[i * 3];
    const by = p[i * 3 + 1];
    const pr = p[i * 3 + 2];
    const L = Math.hypot(bx - ax, by - ay);
    let pos = 0;
    while (L - pos > left) {
      pos += left;
      const t = pos / L;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      if (on) {
        cur.push(x, y, pr);
        runs.push(cur);
        cur = [];
      } else cur = [x, y, pr];
      on = !on;
      left = on ? dash : gap;
    }
    left -= L - pos;
    if (on) cur.push(bx, by, pr);
  }
  if (on && cur.length >= 6) runs.push(cur);
  return runs;
}

// Traço: { ..., g:1 = forma geométrica, d:1 = pontilhado, dn = quantos pontos do início são pontilhados }
export function strokePath(s: TShape): InkPath {
  let path = pathCache.get(s);
  if (path) return path;
  const n = s.p.length / 3;
  if (s.d && n >= 2) {
    path = new Path2D() as InkPath;
    const dn = Math.min(n, s.dn || n);
    const dash = Math.max(9, s.w * 3.2);
    const gap = Math.max(7, s.w * 2.6);
    const caps = new Path2D();
    const add = (sub: InkPath) => {
      path!.addPath(sub);
      if (sub.caps) caps.addPath(sub.caps);
    };
    for (const run of dashRuns(s.p, dn, dash, gap)) add(solidPath({ t: s.t, w: s.w, g: 1, p: run }));
    if (dn < n) add(solidPath({ t: s.t, w: s.w, g: 1, p: s.p.slice((dn - 1) * 3) }));
    path.caps = caps;
  } else path = solidPath(s);
  pathCache.set(s, path);
  return path;
}

function solidPath(s: TShape): InkPath {
  const path = new Path2D() as InkPath;
  const p = s.p;
  const n = p.length / 3;
  if (n === 0) return path;

  let span = 0;
  for (let i = 1; i < n && span < 0.5; i++) span += Math.hypot(p[i * 3] - p[i * 3 - 3], p[i * 3 + 1] - p[i * 3 - 2]);
  if (n === 1 || span < 0.5) {
    // um ponto: bolinha
    const r = Math.max(radiusAt(s, 0), 0.3);
    path.arc(p[0], p[1], r, 0, TAU);
    return path;
  }

  const { left, right, joints } = outline(s);
  // Círculos nas pontas, meias-voltas e cantos. São pintados à parte (ver fillStroke), então o
  // arredondado é garantido seja qual for o desenho.
  const caps = new Path2D();
  for (const [x, y, r] of joints) {
    caps.moveTo(x + r, y);
    caps.arc(x, y, r, 0, TAU);
  }
  path.caps = caps;
  const pts: number[] = [];
  for (let i = 0; i < left.length; i += 2) pts.push(left[i], left[i + 1]);
  // ponta final
  cap(pts, p[(n - 1) * 3], p[(n - 1) * 3 + 1], left[left.length - 2], left[left.length - 1], right[right.length - 2], right[right.length - 1]);
  for (let i = right.length - 2; i >= 0; i -= 2) pts.push(right[i], right[i + 1]);
  // ponta inicial
  cap(pts, p[0], p[1], right[0], right[1], left[0], left[1]);

  const m = pts.length / 2;
  path.moveTo((pts[0] + pts[2]) / 2, (pts[1] + pts[3]) / 2);
  for (let i = 1; i <= m; i++) {
    const a = (i % m) * 2;
    const b = ((i + 1) % m) * 2;
    path.quadraticCurveTo(pts[a], pts[a + 1], (pts[a] + pts[b]) / 2, (pts[a + 1] + pts[b + 1]) / 2);
  }
  path.closePath();
  return path;
}

// Meia-volta de (ax,ay) até (bx,by) em torno do centro, pelo lado de fora.
function cap(out: number[], cx: number, cy: number, ax: number, ay: number, bx: number, by: number) {
  const a0 = Math.atan2(ay - cy, ax - cx);
  const a1 = Math.atan2(by - cy, bx - cx);
  const r = (Math.hypot(ax - cx, ay - cy) + Math.hypot(bx - cx, by - cy)) / 2;
  let d = a1 - a0;
  while (d <= 0) d += TAU; // sempre no mesmo sentido do contorno
  const steps = 6;
  for (let k = 1; k < steps; k++) {
    const ang = a0 + (d * k) / steps;
    out.push(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
  }
}

export function bbox(it: TStroke): TBox {
  let b = boxCache.get(it);
  if (b) return b;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const p = it.p;
  for (let i = 0; i < p.length; i += 3) {
    if (p[i] < x0) x0 = p[i];
    if (p[i] > x1) x1 = p[i];
    if (p[i + 1] < y0) y0 = p[i + 1];
    if (p[i + 1] > y1) y1 = p[i + 1];
  }
  const m = it.w;
  b = [x0 - m, y0 - m, x1 + m, y1 + m];
  boxCache.set(it, b);
  return b;
}

function segDist2(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + dx * t;
  const cy = ay + dy * t;
  return (px - cx) ** 2 + (py - cy) ** 2;
}

// O círculo (x,y,r) encosta no traço?
export function hitStroke(s: TStroke, x: number, y: number, r: number) {
  const b = bbox(s);
  if (x < b[0] - r || x > b[2] + r || y < b[1] - r || y > b[3] + r) return false;
  const p = s.p;
  const n = p.length / 3;
  if (n === 1) return (p[0] - x) ** 2 + (p[1] - y) ** 2 <= (r + radiusAt(s, 0)) ** 2;
  for (let i = 1; i < n; i++) {
    const rr = r + radiusAt(s, i);
    if (segDist2(x, y, p[i * 3 - 3], p[i * 3 - 2], p[i * 3], p[i * 3 + 1]) <= rr * rr) return true;
  }
  return false;
}

// Borracha parcial: devolve os pedaços que sobram do traço (ou null se a borracha não encostou nele).
export function eraseFrom(s: TStroke, x: number, y: number, r: number): TStroke[] | null {
  if (!hitStroke(s, x, y, r)) return null;
  const src: number[] = [];
  const p = dense(s.p, Math.max(1.5, r * 0.5), src);
  const n = p.length / 3;
  const dn = s.d ? s.dn || s.p.length / 3 : 0; // pontos do início que são pontilhados
  const pieces: TStroke[] = [];
  let cur: number[] = [];
  let dashed = 0;
  const close = () => {
    if (cur.length >= 6) {
      const piece: TStroke = { id: uid(), k: 's', t: s.t, c: s.c, w: s.w, p: cur };
      if (s.g) piece.g = 1;
      if (dashed >= 2) {
        piece.d = 1;
        if (dashed < cur.length / 3) piece.dn = dashed;
      }
      pieces.push(piece);
    }
    cur = [];
    dashed = 0;
  };
  const rr = r + radiusAt(s, 0) * 0.5;
  for (let i = 0; i < n; i++) {
    if ((p[i * 3] - x) ** 2 + (p[i * 3 + 1] - y) ** 2 <= rr * rr) close();
    else {
      cur.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
      if (src[i] < dn) dashed++;
    }
  }
  close();
  return pieces;
}

// Garante que não há pontos mais distantes que `step` (para traços retos).
// `src` recebe, para cada ponto gerado, o índice do ponto original.
function dense(p: number[], step: number, src: number[] = []) {
  const out = [p[0], p[1], p[2]];
  src.push(0);
  for (let i = 3; i < p.length; i += 3) {
    const ax = p[i - 3];
    const ay = p[i - 2];
    const ap = p[i - 1];
    const bx = p[i];
    const by = p[i + 1];
    const bp = p[i + 2];
    const d = Math.hypot(bx - ax, by - ay);
    const k = Math.floor(d / step);
    for (let j = 1; j <= k; j++) {
      const t = j / (k + 1);
      out.push(r1(ax + (bx - ax) * t), r1(ay + (by - ay) * t), ap + (bp - ap) * t);
      src.push(i / 3);
    }
    out.push(bx, by, bp);
    src.push(i / 3);
  }
  return out;
}

export function r1(v: number) {
  return Math.round(v * 100) / 100;
}

export function inPolygon(x: number, y: number, poly: number[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = poly[i];
    const yi = poly[i + 1];
    const xj = poly[j];
    const yj = poly[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// O traço está (na maior parte) dentro do laço?
export function itemInLasso(it: TStroke, poly: number[]) {
  const p = it.p;
  let inC = 0;
  let tot = 0;
  const step = Math.max(3, Math.floor(p.length / 3 / 40) * 3);
  for (let i = 0; i < p.length; i += step) {
    tot++;
    if (inPolygon(p[i], p[i + 1], poly)) inC++;
  }
  return inC / tot >= 0.6;
}

// Move, gira e redimensiona um traço de uma vez:
//   p' = O + k · R(rot) · (p − O) + (dx, dy)
// m = { k (escala), rot (giro em radianos), ox, oy (ponto fixo O), dx, dy }.
// O traço muda de espessura junto com o tamanho.
export function transformed(it: TStroke, m: TMove): TStroke {
  const k = m.k || 1;
  const rot = m.rot || 0;
  const ox = m.ox || 0;
  const oy = m.oy || 0;
  const dx = m.dx || 0;
  const dy = m.dy || 0;
  const c = Math.cos(rot) * k;
  const s = Math.sin(rot) * k;
  const fx = (x: number, y: number) => ox + (x - ox) * c - (y - oy) * s + dx;
  const fy = (x: number, y: number) => oy + (x - ox) * s + (y - oy) * c + dy;
  const p = it.p.slice();
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i];
    const y = p[i + 1];
    p[i] = r1(fx(x, y));
    p[i + 1] = r1(fy(x, y));
  }
  return { ...it, p, w: Math.max(0.1, Math.round(it.w * k * 1000) / 1000) };
}

// Aplica uma alteração (apagar ids, depois inserir/substituir itens).
export function applyOp(items: TStroke[], delIds: string[] | undefined, putItems: TStroke[] | undefined) {
  const del = new Set(delIds || []);
  const put = new Map((putItems || []).map((it) => [it.id, it]));
  const out: TStroke[] = [];
  for (const it of items) {
    if (put.has(it.id)) {
      out.push(put.get(it.id)!);
      put.delete(it.id);
    } else if (!del.has(it.id)) out.push(it);
  }
  for (const it of put.values()) out.push(it);
  return out;
}

// ---------- formas ----------

export type ShapeKind = 'line' | 'arrow' | 'rect' | 'ellipse';
export function shapePoints(kind: ShapeKind, x0: number, y0: number, x1: number, y1: number, w = 3) {
  const pts: number[] & { shaft?: number } = [];
  const add = (x: number, y: number) => pts.push(r1(x), r1(y), 0.5);
  const line = (ax: number, ay: number, bx: number, by: number) => {
    const d = Math.hypot(bx - ax, by - ay);
    const k = Math.max(1, Math.ceil(d / 6));
    for (let i = pts.length ? 1 : 0; i <= k; i++) add(ax + ((bx - ax) * i) / k, ay + ((by - ay) * i) / k);
  };
  if (kind === 'line') line(x0, y0, x1, y1);
  else if (kind === 'arrow') {
    line(x0, y0, x1, y1);
    pts.shaft = pts.length / 3; // daqui em diante é a ponta
    const ang = Math.atan2(y1 - y0, x1 - x0);
    // ponta proporcional ao traço (fino = pequena, grosso = grande) e igual para setas curtas ou compridas
    const L = 8 + w * 4.5;
    line(x1, y1, x1 - L * Math.cos(ang - 0.45), y1 - L * Math.sin(ang - 0.45));
    line(x1 - L * Math.cos(ang - 0.45), y1 - L * Math.sin(ang - 0.45), x1, y1);
    line(x1, y1, x1 - L * Math.cos(ang + 0.45), y1 - L * Math.sin(ang + 0.45));
  } else if (kind === 'rect') {
    line(x0, y0, x1, y0);
    line(x1, y0, x1, y1);
    line(x1, y1, x0, y1);
    line(x0, y1, x0, y0);
  } else if (kind === 'ellipse') {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const rx = Math.abs(x1 - x0) / 2;
    const ry = Math.abs(y1 - y0) / 2;
    const k = Math.max(24, Math.ceil((rx + ry) / 3));
    for (let i = 0; i <= k; i++) add(cx + rx * Math.cos((TAU * i) / k), cy + ry * Math.sin((TAU * i) / k));
  }
  return pts;
}

// ---------- desenho ----------

export const HL_ALPHA = 0.5;

// Pinta um traço: o corpo e, por cima, os arremates redondos. Onde a tinta é translúcida (marca-texto em
// andamento), `noCaps` evita pintar duas vezes.
export function fillStroke(ctx: CanvasRenderingContext2D, s: TShape, noCaps?: boolean) {
  const path = strokePath(s);
  ctx.fill(path);
  if (path.caps && !noCaps) ctx.fill(path.caps);
}
