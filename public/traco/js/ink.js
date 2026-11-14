// Geometria e desenho da tinta. Usado pelo apresentador, pelo espectador
// e pela exportação em PDF, para que o traço seja idêntico nos três.
//
// Traço: { id, k:'s', t:'pen'|'hl', c:'#rrggbb', w:espessura, p:[x,y,pressão, ...] }
// Imagem: { id, k:'i', x, y, w, h, src:dataURL }
// Coordenadas em unidades de página (uma página retrato tem 1000 de largura).

const TAU = Math.PI * 2;
const pathCache = new WeakMap();
const boxCache = new WeakMap();

export function uid() {
  const a = new Uint8Array(9);
  crypto.getRandomValues(a);
  let s = "";
  for (const b of a) s += b.toString(36).padStart(2, "0");
  return s.slice(0, 12);
}

export function radiusAt(s, i) {
  const half = s.w / 2;
  if (s.t !== "pen") return half;
  const pr = s.p[i * 3 + 2];
  return half * (0.7 + 0.6 * pr); // a pressão engrossa ou afina, sem exagero
}

// Linha central suavizada: tira o tremor fino da caneta (que amostra a
// posição centenas de vezes por segundo) sem mudar o desenho. Formas
// geométricas (s.g) ficam como estão, com cantos vivos.
function centerline(s) {
  const p = s.p;
  const n = p.length / 3;
  const X = new Float64Array(n), Y = new Float64Array(n), R = new Float64Array(n);
  for (let i = 0; i < n; i++) { X[i] = p[i * 3]; Y[i] = p[i * 3 + 1]; R[i] = radiusAt(s, i); }
  if (s.g || n < 3) return { X, Y, R, n };
  for (let pass = 0; pass < 2; pass++) {
    let px = X[0], py = Y[0], pr = R[0];
    for (let i = 1; i < n - 1; i++) {
      const cx = X[i], cy = Y[i], cr = R[i];
      X[i] = (px + 2 * cx + X[i + 1]) / 4;
      Y[i] = (py + 2 * cy + Y[i + 1]) / 4;
      R[i] = (pr + 2 * cr + R[i + 1]) / 4;
      px = cx; py = cy; pr = cr;
    }
  }
  return { X, Y, R, n };
}

// Contorno do traço: um polígono que acompanha a linha central com a
// espessura variando conforme a pressão, com pontas arredondadas.
// Devolve também `joints`: pontos onde a linha dá meia-volta ou faz um
// canto, que recebem um círculo para o traço ficar sempre boleado.
function outline(s) {
  const { X, Y, R, n } = centerline(s);
  const left = [];
  const right = [];
  const joints = [];
  let tx = 1, ty = 0;
  let lastLx = NaN, lastLy = NaN, lastRx = NaN, lastRy = NaN;
  const minD2 = Math.max(0.04, (s.w * 0.08) ** 2);

  // comprimento acumulado ao longo da linha
  const cum = new Float64Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]);

  // direção inicial: a do traço inteiro (vale para risquinhos bem curtos)
  const ol = Math.hypot(X[n - 1] - X[0], Y[n - 1] - Y[0]);
  if (ol > 1e-6) { tx = (X[n - 1] - X[0]) / ol; ty = (Y[n - 1] - Y[0]) / ol; }

  let a = 0, b = 0, lastJoint = -1;
  for (let i = 0; i < n; i++) {
    const x = X[i], y = Y[i], r = R[i];
    // A direção é medida numa janela proporcional à espessura. Com pontos
    // muito juntos (zoom alto, caneta devagar) e traço grosso, uma janela
    // pequena faz a borda "dançar" e a ponta sair quadrada.
    const reach = s.g ? 0 : Math.max(1, r * 0.7);
    while (a < i - 1 && cum[i] - cum[a + 1] >= reach) a++;
    if (a > i - 1) a = Math.max(i - 1, 0);
    if (b < i + 1) b = Math.min(i + 1, n - 1);
    while (b < n - 1 && cum[b] - cum[i] < reach) b++;
    const ia = Math.min(a, Math.max(i - 1, 0));
    const dx = X[b] - X[ia], dy = Y[b] - Y[ia];
    const len = Math.hypot(dx, dy);
    if (len > Math.max(1e-6, reach * 0.25)) { tx = dx / len; ty = dy / len; }

    // meia-volta ou canto: marca para receber um círculo
    if (i > 0 && i < n - 1) {
      const d1x = x - X[ia], d1y = y - Y[ia], d2x = X[b] - x, d2y = Y[b] - y;
      const l1 = Math.hypot(d1x, d1y), l2 = Math.hypot(d2x, d2y);
      if (l1 > 1e-6 && l2 > 1e-6 && (d1x * d2x + d1y * d2y) / (l1 * l2) < 0.5) {
        const q = lastJoint < 0 ? null : joints[joints.length - 1];
        if (!q || Math.hypot(x - q[0], y - q[1]) > r * 0.35) { joints.push([x, y, r]); lastJoint = i; }
      }
    }

    const nx = -ty * r, ny = tx * r;
    const lx = x - nx, ly = y - ny, rx = x + nx, ry = y + ny;
    const end = i === n - 1;
    if (end || !((lx - lastLx) ** 2 + (ly - lastLy) ** 2 < minD2)) {
      left.push(lx, ly); lastLx = lx; lastLy = ly;
    }
    if (end || !((rx - lastRx) ** 2 + (ry - lastRy) ** 2 < minD2)) {
      right.push(rx, ry); lastRx = rx; lastRy = ry;
    }
  }
  joints.push([X[0], Y[0], R[0]], [X[n - 1], Y[n - 1], R[n - 1]]);
  return { left, right, joints };
}

// Corta a linha em trechos "ligados" de comprimento `dash`, separados por `gap`.
function dashRuns(p, count, dash, gap) {
  const runs = [];
  let on = true, left = dash, cur = [p[0], p[1], p[2]];
  for (let i = 1; i < count; i++) {
    const ax = p[i * 3 - 3], ay = p[i * 3 - 2], bx = p[i * 3], by = p[i * 3 + 1], pr = p[i * 3 + 2];
    const L = Math.hypot(bx - ax, by - ay);
    let pos = 0;
    while (L - pos > left) {
      pos += left;
      const t = pos / L, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      if (on) { cur.push(x, y, pr); runs.push(cur); cur = []; } else cur = [x, y, pr];
      on = !on;
      left = on ? dash : gap;
    }
    left -= L - pos;
    if (on) cur.push(bx, by, pr);
  }
  if (on && cur.length >= 6) runs.push(cur);
  return runs;
}

// Traço: { ..., g:1 = forma geométrica, d:1 = pontilhado, dn = quantos pontos
// do início são pontilhados (na seta, a ponta fica contínua) }
export function strokePath(s) {
  let path = pathCache.get(s);
  if (path) return path;
  const n = s.p.length / 3;
  if (s.d && n >= 2) {
    path = new Path2D();
    const dn = Math.min(n, s.dn || n);
    const dash = Math.max(9, s.w * 3.2), gap = Math.max(7, s.w * 2.6);
    const caps = new Path2D();
    const add = (sub) => { path.addPath(sub); if (sub.caps) caps.addPath(sub.caps); };
    for (const run of dashRuns(s.p, dn, dash, gap)) add(solidPath({ t: s.t, w: s.w, g: 1, p: run }));
    if (dn < n) add(solidPath({ t: s.t, w: s.w, g: 1, p: s.p.slice((dn - 1) * 3) }));
    path.caps = caps;
  } else path = solidPath(s);
  pathCache.set(s, path);
  return path;
}

function solidPath(s) {
  const path = new Path2D();
  const p = s.p;
  const n = p.length / 3;
  if (n === 0) return path;

  let span = 0;
  for (let i = 1; i < n && span < 0.5; i++) {
    span += Math.hypot(p[i * 3] - p[i * 3 - 3], p[i * 3 + 1] - p[i * 3 - 2]);
  }
  if (n === 1 || span < 0.5) { // um ponto: bolinha
    const r = Math.max(radiusAt(s, 0), 0.3);
    path.arc(p[0], p[1], r, 0, TAU);
    return path;
  }

  const { left, right, joints } = outline(s);
  // Círculos nas pontas, meias-voltas e cantos. São pintados à parte (ver
  // fillStroke), então o arredondado é garantido seja qual for o desenho.
  const caps = new Path2D();
  for (const [x, y, r] of joints) { caps.moveTo(x + r, y); caps.arc(x, y, r, 0, TAU); }
  path.caps = caps;
  const pts = [];
  for (let i = 0; i < left.length; i += 2) pts.push(left[i], left[i + 1]);
  // ponta final
  cap(pts, p[(n - 1) * 3], p[(n - 1) * 3 + 1], left[left.length - 2], left[left.length - 1], right[right.length - 2], right[right.length - 1]);
  for (let i = right.length - 2; i >= 0; i -= 2) pts.push(right[i], right[i + 1]);
  // ponta inicial
  cap(pts, p[0], p[1], right[0], right[1], left[0], left[1]);

  const m = pts.length / 2;
  path.moveTo((pts[0] + pts[2]) / 2, (pts[1] + pts[3]) / 2);
  for (let i = 1; i <= m; i++) {
    const a = (i % m) * 2, b = ((i + 1) % m) * 2;
    path.quadraticCurveTo(pts[a], pts[a + 1], (pts[a] + pts[b]) / 2, (pts[a + 1] + pts[b + 1]) / 2);
  }
  path.closePath();
  return path;
}

// Meia-volta de (ax,ay) até (bx,by) em torno do centro, pelo lado de fora.
function cap(out, cx, cy, ax, ay, bx, by) {
  const a0 = Math.atan2(ay - cy, ax - cx);
  let a1 = Math.atan2(by - cy, bx - cx);
  const r = (Math.hypot(ax - cx, ay - cy) + Math.hypot(bx - cx, by - cy)) / 2;
  let d = a1 - a0;
  while (d <= 0) d += TAU; // sempre no mesmo sentido do contorno
  const steps = 6;
  for (let k = 1; k < steps; k++) {
    const ang = a0 + (d * k) / steps;
    out.push(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
  }
}

export function bbox(it) {
  if (it.k === "i") {
    if (!it.r) return [it.x, it.y, it.x + it.w, it.y + it.h];
    const c = Math.abs(Math.cos(it.r)), s = Math.abs(Math.sin(it.r));
    const hw = (it.w * c + it.h * s) / 2, hh = (it.w * s + it.h * c) / 2;
    const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
    return [cx - hw, cy - hh, cx + hw, cy + hh];
  }
  let b = boxCache.get(it);
  if (b) return b;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
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

function segDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + dx * t, cy = ay + dy * t;
  return (px - cx) ** 2 + (py - cy) ** 2;
}

// O círculo (x,y,r) encosta no traço?
export function hitStroke(s, x, y, r) {
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

// Borracha parcial: devolve os pedaços que sobram do traço (ou null se a
// borracha não encostou nele).
export function eraseFrom(s, x, y, r) {
  if (!hitStroke(s, x, y, r)) return null;
  const src = [];
  const p = dense(s.p, Math.max(1.5, r * 0.5), src);
  const n = p.length / 3;
  const dn = s.d ? s.dn || s.p.length / 3 : 0; // pontos do início que são pontilhados
  const pieces = [];
  let cur = [], dashed = 0;
  const close = () => {
    if (cur.length >= 6) {
      const piece = { id: uid(), k: "s", t: s.t, c: s.c, w: s.w, p: cur };
      if (s.g) piece.g = 1;
      if (dashed >= 2) { piece.d = 1; if (dashed < cur.length / 3) piece.dn = dashed; }
      pieces.push(piece);
    }
    cur = []; dashed = 0;
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
function dense(p, step, src = []) {
  const out = [p[0], p[1], p[2]];
  src.push(0);
  for (let i = 3; i < p.length; i += 3) {
    const ax = p[i - 3], ay = p[i - 2], ap = p[i - 1];
    const bx = p[i], by = p[i + 1], bp = p[i + 2];
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

export function r1(v) { return Math.round(v * 100) / 100; }

export function inPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// O item está (na maior parte) dentro do laço?
export function itemInLasso(it, poly) {
  if (it.k === "i") return inPolygon(it.x + it.w / 2, it.y + it.h / 2, poly);
  const p = it.p;
  let inC = 0, tot = 0;
  const step = Math.max(3, Math.floor(p.length / 3 / 40) * 3);
  for (let i = 0; i < p.length; i += step) {
    tot++;
    if (inPolygon(p[i], p[i + 1], poly)) inC++;
  }
  return inC / tot >= 0.6;
}

export function moved(it, dx, dy) {
  if (it.k === "i") return { ...it, x: r1(it.x + dx), y: r1(it.y + dy) };
  const p = it.p.slice();
  for (let i = 0; i < p.length; i += 3) { p[i] = r1(p[i] + dx); p[i + 1] = r1(p[i + 1] + dy); }
  return { ...it, p };
}

// O ponto está sobre a imagem? (leva em conta o giro dela)
export function inImage(it, x, y) {
  let dx = x - (it.x + it.w / 2), dy = y - (it.y + it.h / 2);
  if (it.r) {
    const c = Math.cos(-it.r), s = Math.sin(-it.r);
    [dx, dy] = [dx * c - dy * s, dx * s + dy * c];
  }
  return Math.abs(dx) <= it.w / 2 && Math.abs(dy) <= it.h / 2;
}

// Move, gira e redimensiona um item de uma vez:
//   p' = O + k · R(rot) · (p − O) + (dx, dy)
// m = { k (escala), rot (giro em radianos), ox, oy (ponto fixo O), dx, dy }.
// Traços mudam de espessura junto com o tamanho; imagens guardam o giro em `r`.
export function transformed(it, m) {
  const k = m.k || 1, rot = m.rot || 0, ox = m.ox || 0, oy = m.oy || 0, dx = m.dx || 0, dy = m.dy || 0;
  const c = Math.cos(rot) * k, s = Math.sin(rot) * k;
  const fx = (x, y) => ox + (x - ox) * c - (y - oy) * s + dx;
  const fy = (x, y) => oy + (x - ox) * s + (y - oy) * c + dy;
  if (it.k === "i") {
    const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
    const w = r1(it.w * k), h = r1(it.h * k);
    const out = { ...it, x: r1(fx(cx, cy) - w / 2), y: r1(fy(cx, cy) - h / 2), w, h };
    let r = (it.r || 0) + rot;
    r = Math.atan2(Math.sin(r), Math.cos(r)); // entre −π e π
    if (Math.abs(r) > 1e-4) out.r = Math.round(r * 1e4) / 1e4; else delete out.r;
    return out;
  }
  const p = it.p.slice();
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], y = p[i + 1];
    p[i] = r1(fx(x, y));
    p[i + 1] = r1(fy(x, y));
  }
  return { ...it, p, w: Math.max(0.4, r1(it.w * k)) };
}

// Aplica uma alteração (apagar ids, depois inserir/substituir itens).
export function applyOp(items, delIds, putItems) {
  const del = new Set(delIds || []);
  const put = new Map((putItems || []).map((it) => [it.id, it]));
  const out = [];
  for (const it of items) {
    if (put.has(it.id)) { out.push(put.get(it.id)); put.delete(it.id); }
    else if (!del.has(it.id)) out.push(it);
  }
  for (const it of put.values()) out.push(it);
  return out;
}

// ---------- formas ----------

export function shapePoints(kind, x0, y0, x1, y1, w = 3) {
  const pts = [];
  const add = (x, y) => pts.push(r1(x), r1(y), 0.5);
  const line = (ax, ay, bx, by) => {
    const d = Math.hypot(bx - ax, by - ay);
    const k = Math.max(1, Math.ceil(d / 6));
    for (let i = pts.length ? 1 : 0; i <= k; i++) add(ax + ((bx - ax) * i) / k, ay + ((by - ay) * i) / k);
  };
  if (kind === "line") line(x0, y0, x1, y1);
  else if (kind === "arrow") {
    line(x0, y0, x1, y1);
    pts.shaft = pts.length / 3; // daqui em diante é a ponta
    const ang = Math.atan2(y1 - y0, x1 - x0);
    // ponta proporcional ao traço (fino = pequena, grosso = grande) e igual
    // para setas curtas ou compridas
    const L = 8 + w * 4.5;
    line(x1, y1, x1 - L * Math.cos(ang - 0.45), y1 - L * Math.sin(ang - 0.45));
    line(x1 - L * Math.cos(ang - 0.45), y1 - L * Math.sin(ang - 0.45), x1, y1);
    line(x1, y1, x1 - L * Math.cos(ang + 0.45), y1 - L * Math.sin(ang + 0.45));
  } else if (kind === "rect") {
    line(x0, y0, x1, y0); line(x1, y0, x1, y1); line(x1, y1, x0, y1); line(x0, y1, x0, y0);
  } else if (kind === "ellipse") {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2;
    const k = Math.max(24, Math.ceil((rx + ry) / 3));
    for (let i = 0; i <= k; i++) add(cx + rx * Math.cos((TAU * i) / k), cy + ry * Math.sin((TAU * i) / k));
  }
  return pts;
}

// ---------- desenho ----------

export const HL_ALPHA = 0.5;

// Papel: fundo branco e, se pedido, pauta ou quadriculado bem claros.
// `px` é o tamanho de um pixel do dispositivo em unidades de página.
// `linesOnly` (estúdio): só as linhas, numa camada à parte que só o professor vê.
export function drawPaper(ctx, page, paper, px, linesOnly) {
  if (!linesOnly) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, page.w, page.h);
  }
  if (!paper || paper.type === "blank" || page.bg || page.hasBg) return;
  const gap = Math.max(12, paper.size || 40);
  const lw = Math.max(px, 0.7);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, page.w, page.h);
  ctx.clip();
  // estúdio: cores bem fraquinhas (só para guiar a escrita)
  ctx.fillStyle = paper.type === "grid" ? "#eaf0f8" : paper.type === "dots" ? "#cfd9e8" : "#e3eaf5";
  const snap = (v) => Math.round(v / px) * px;
  if (paper.type === "lined") {
    const top = gap * 2;
    for (let y = top; y < page.h - gap * 0.6; y += gap) ctx.fillRect(0, snap(y), page.w, lw);
    ctx.fillStyle = "#f7dfe2";
    ctx.fillRect(snap(gap * 2.2), 0, lw, page.h);
  } else if (paper.type === "grid") {
    for (let y = gap; y < page.h; y += gap) ctx.fillRect(0, snap(y), page.w, lw);
    for (let x = gap; x < page.w; x += gap) ctx.fillRect(snap(x), 0, lw, page.h);
  } else if (paper.type === "dots") {
    // pontilhado (estúdio)
    const d = Math.max(px * 1.2, Math.min(2.2, gap * 0.05));
    ctx.beginPath();
    for (let y = gap; y < page.h; y += gap)
      for (let x = gap; x < page.w; x += gap) {
        ctx.moveTo(x + d, y);
        ctx.arc(x, y, d, 0, 6.283);
      }
    ctx.fill();
  }
  ctx.restore();
}

// Pinta um traço: o corpo e, por cima, os arremates redondos. Onde a tinta
// é translúcida (marca-texto em andamento), `noCaps` evita pintar duas vezes.
export function fillStroke(ctx, s, noCaps) {
  const path = strokePath(s);
  ctx.fill(path);
  if (path.caps && !noCaps) ctx.fill(path.caps);
}

export function drawStrokes(ctx, items, kind, view, noCaps) {
  for (const it of items) {
    if (it.k !== "s" || (it.t === "hl") !== (kind === "hl")) continue;
    if (view) {
      const b = bbox(it);
      if (b[2] < view[0] || b[0] > view[2] || b[3] < view[1] || b[1] > view[3]) continue;
    }
    ctx.fillStyle = it.c;
    fillStroke(ctx, it, noCaps);
  }
}

export function drawImages(ctx, items, getImg) {
  for (const it of items) {
    if (it.k !== "i") continue;
    const img = getImg(it);
    if (it.r) { // imagem girada em torno do próprio centro
      ctx.save();
      ctx.translate(it.x + it.w / 2, it.y + it.h / 2);
      ctx.rotate(it.r);
      ctx.translate(-it.x - it.w / 2, -it.y - it.h / 2);
    }
    if (img) ctx.drawImage(img, it.x, it.y, it.w, it.h);
    else {
      ctx.fillStyle = "#eef1f5";
      ctx.fillRect(it.x, it.y, it.w, it.h);
    }
    if (it.r) ctx.restore();
  }
}

// Desenha a página inteira em um único canvas (miniaturas e exportação).
export function drawPageFlat(ctx, page, opts) {
  const { paper, getImg, bgImg, px = 1 } = opts;
  drawPaper(ctx, page, paper, px);
  if (bgImg) ctx.drawImage(bgImg, 0, 0, page.w, page.h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, page.w, page.h);
  ctx.clip();
  drawImages(ctx, page.items, getImg);
  // Marca-texto: pintado opaco numa camada à parte e só então aplicado com
  // transparência, igual ao que se vê na tela.
  if (page.items.some((it) => it.k === "s" && it.t === "hl")) {
    const layer = document.createElement("canvas");
    layer.width = ctx.canvas.width;
    layer.height = ctx.canvas.height;
    const lx = layer.getContext("2d");
    lx.setTransform(ctx.getTransform());
    drawStrokes(lx, page.items, "hl");
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = HL_ALPHA;
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
    layer.width = layer.height = 0;
  }
  drawStrokes(ctx, page.items, "pen");
  ctx.restore();
}

// Cache de imagens decodificadas, limitado pela memória que ocupam.
const imgCache = new Map();
const IMG_BUDGET = 48e6; // pixels
export function loadImage(src) {
  let e = imgCache.get(src);
  if (e) {
    imgCache.delete(src); // move para o fim (mais recente)
    imgCache.set(src, e);
    e.used = performance.now();
    return e;
  }
  e = { img: null, promise: null, px: 0, used: performance.now() };
  e.promise = new Promise((res) => {
    const im = new Image();
    im.onload = () => { e.img = im; e.px = im.naturalWidth * im.naturalHeight; trim(); res(im); };
    im.onerror = () => res(null);
    im.src = src;
  });
  imgCache.set(src, e);
  return e;
}

function trim() {
  let total = 0;
  for (const e of imgCache.values()) total += e.px;
  const now = performance.now();
  for (const [k, e] of imgCache) {
    if (total <= IMG_BUDGET) break;
    if (now - e.used < 3000) continue; // em uso agora
    total -= e.px;
    imgCache.delete(k);
  }
}
