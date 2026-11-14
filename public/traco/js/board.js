// A "mesa": mostra uma página, cuida de zoom/arrasto e entrega os gestos de
// escrita para quem a controla. Usada pelo apresentador e pelo espectador.

import { drawPaper, drawStrokes, drawImages, fillStroke, loadImage, bbox, HL_ALPHA } from "./ink.js";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const LASER_HOLD = 2000; // o laser fica na tela por 2 s depois de parar
const LASER_FADE = 450; // e então some suavemente

export class Board {
  constructor(root, opts = {}) {
    this.root = root;
    this.readonly = !!opts.readonly;
    this.fit = opts.fit || "width"; // 'width' (apresentador) ou 'contain' (espectador)
    this.onView = opts.onView || (() => {});
    this.onPen = opts.onPen || (() => {});
    this.fingerDraw = opts.fingerDraw || (() => true);
    this.penMode = opts.penMode || (() => false); // já se usou caneta neste aparelho?
    this.handMode = opts.handMode || (() => false); // ferramenta "mão": tudo move a folha
    this.lastPen = -1e9; // último sinal da caneta (inclui pairar sobre a tela)
    this.lastTs = 0; // horário do último ponto aproveitado
    this.insetTop = opts.insetTop || 0; // espaço ocupado por barras flutuantes
    this.insetBottom = opts.insetBottom || 0;
    this.tool = null; // { start, move, end, cancel, hover }
    this.page = null;
    this.paper = null;
    this.view = { s: 1, x: 0, y: 0 };
    this.rendered = { s: 1, x: 0, y: 0 };
    this.fast = true;
    this.hidden = new Set();
    this.liveStrokes = new Map();
    this.laser = [];
    this.lasso = null;
    this.selection = null; // { box, items, m } — m: movimento/giro/escala em andamento (ink.transformed)
    this.laserAt = 0; // última atividade do laser
    this.laserDown = false; // o laser está encostado na tela agora?
    this.cursor = null; // { x, y, r }
    this.touches = new Map();
    this.gesture = null;
    this.draw = null;
    this.spaceDown = false;
    this.lastTap = 0;

    root.classList.add("board");
    root.innerHTML =
      '<div class="board-layers"><canvas class="c-bg"></canvas><canvas class="c-paper"></canvas><div class="cam-slot"></div><canvas class="c-hl"></canvas><canvas class="c-ink"></canvas></div><canvas class="c-live"></canvas>';
    // Estúdio: as linhas do papel ficam em "c-paper" (só o professor vê; a live não leva) e a câmera da live
    // entra em "cam-slot", entre o papel e a tinta (a escrita fica por cima da câmera).
    this.layers = root.firstChild;
    const [bg, paperC, camSlot, hl, ink] = this.layers.children;
    this.cBg = bg; this.cPaper = paperC; this.camSlot = camSlot; this.cHl = hl; this.cInk = ink; this.cLive = root.lastChild;
    this.xBg = bg.getContext("2d", { alpha: true });
    this.xPaper = paperC.getContext("2d");
    this.xHl = hl.getContext("2d");
    this.xInk = ink.getContext("2d");
    this.xLive = this.cLive.getContext("2d", { desynchronized: true });

    this.resize = this.resize.bind(this);
    this.ro = new ResizeObserver(this.resize);
    this.ro.observe(root);

    const on = (t, f, o) => root.addEventListener(t, f.bind(this), o);
    on("pointerdown", this.onDown);
    on("pointermove", this.onMove);
    on("pointerup", this.onUp);
    on("pointercancel", this.onUp);
    on("pointerleave", () => { if (!this.draw && this.cursor) { this.cursor = null; this.invalidateLive(); } });
    on("wheel", this.onWheel, { passive: false });
    on("contextmenu", (e) => e.preventDefault());
    // No iPad, o sistema tenta transformar um toque demorado em seleção de
    // texto, lupa ou arrasto, e quando faz isso corta a caneta no meio do
    // traço. Recusar esses gestos aqui mantém a caneta sempre com o app.
    for (const type of ["touchstart", "touchmove", "touchend"]) {
      root.addEventListener(type, (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    }
    // contadores para diagnóstico (aparecem com ?debug=1)
    this.stats = { pen: 0, cut: 0, palm: 0, finger: 0, last: "-" };
    on("dblclick", () => { if (this.readonly) this.fitView(); });
    this.keyDown = (e) => { if (e.code === "Space" && !/INPUT|TEXTAREA/.test(e.target.tagName)) this.spaceDown = true; };
    this.keyUp = (e) => { if (e.code === "Space") this.spaceDown = false; };
    window.addEventListener("keydown", this.keyDown);
    window.addEventListener("keyup", this.keyUp);
    this.resize();
  }

  destroy() {
    this.ro.disconnect();
    window.removeEventListener("keydown", this.keyDown);
    window.removeEventListener("keyup", this.keyUp);
    cancelAnimationFrame(this.rafLive);
    cancelAnimationFrame(this.rafView);
    clearTimeout(this.viewTimer);
    clearTimeout(this.laserTimer);
    this.root.innerHTML = "";
  }

  // ---------- tamanho e visão ----------

  resize() {
    const r = this.root.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const first = !this.W;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.dpr = dpr;
    const cx = this.W ? this.W / 2 : 0;
    this.W = r.width; this.H = r.height;
    for (const c of [this.cBg, this.cPaper, this.cHl, this.cInk, this.cLive]) {
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
    }
    if (this.page) {
      if (first || this.atFit) this.fitView();
      else { this.view.x += this.W / 2 - cx; this.setView(this.view); }
    }
    this.renderAll();
  }

  fitScale() {
    const p = this.page;
    const pad = this.W < 600 ? 8 : 24;
    const sw = (this.W - pad * 2) / p.w;
    const sh = (this.H - pad * 2 - this.insetTop - this.insetBottom) / p.h;
    if (this.fit === "contain") return Math.min(sw, sh);
    return Math.max(Math.min(sw, 1.5), Math.min(sw, sh));
  }

  fitView() {
    if (!this.page || !this.W) return;
    const s = this.fitScale();
    const pad = this.W < 600 ? 8 : 24;
    const ph = this.page.h * s;
    const free = this.H - this.insetTop - this.insetBottom;
    this.view = { s, x: (this.W - this.page.w * s) / 2, y: this.insetTop + (ph < free ? (free - ph) / 2 : pad) };
    this.atFit = true;
    this.renderAll();
    this.onView(this.view, false);
  }

  setView(v, user) {
    const p = this.page;
    if (!p) return;
    const base = this.fitScale();
    const s = clamp(v.s, base * 0.6, Math.max(base * 10, 6));
    const pw = p.w * s, ph = p.h * s, m = 40;
    const top = this.insetTop + m, bottom = this.H - this.insetBottom - m;
    let x = v.x, y = v.y;
    x = pw <= this.W ? (this.W - pw) / 2 : clamp(x, this.W - pw - m, m);
    y = ph <= bottom - top ? clamp(y, Math.min(top, (this.H - ph) / 2), Math.max(bottom - ph, (this.H - ph) / 2)) : clamp(y, bottom - ph, top);
    this.view = { s, x, y };
    if (user) this.atFit = false;
    this.requestViewRender();
    this.onView(this.view, !!user);
  }

  // Região da página que está à vista (descontando as barras flutuantes).
  viewRect() {
    const p = this.page, v = this.view;
    if (!p || !this.W) return null;
    const x0 = Math.max(0, -v.x / v.s), x1 = Math.min(p.w, (this.W - v.x) / v.s);
    const y0 = Math.max(0, (this.insetTop - v.y) / v.s), y1 = Math.min(p.h, (this.H - this.insetBottom - v.y) / v.s);
    if (x1 - x0 < 1 || y1 - y0 < 1) return null;
    return [x0, y0, x1, y1];
  }

  // Visão que enquadra uma região da página nesta tela.
  rectView(r) {
    if (!this.page || !this.W) return null;
    const pad = 8;
    const aw = this.W - pad * 2, ah = this.H - this.insetTop - this.insetBottom - pad * 2;
    const rw = Math.max(20, r[2] - r[0]), rh = Math.max(20, r[3] - r[1]);
    const s = Math.min(aw / rw, ah / rh);
    return { s, x: pad + (aw - rw * s) / 2 - r[0] * s, y: this.insetTop + pad + (ah - rh * s) / 2 - r[1] * s };
  }

  zoomAt(cx, cy, factor) {
    const v = this.view;
    const s = v.s * factor;
    const px = (cx - v.x) / v.s, py = (cy - v.y) / v.s;
    this.setView({ s, x: cx - px * s, y: cy - py * s }, true);
    // setView pode limitar a escala: reancora no ponto
    const s2 = this.view.s;
    if (s2 !== s) this.setView({ s: s2, x: cx - px * s2, y: cy - py * s2 }, true);
  }

  // Enquanto o gesto acontece, se a página for pesada, move as camadas por
  // CSS (instantâneo) e redesenha com nitidez quando o gesto para.
  requestViewRender() {
    if (this.fast) {
      if (!this.rafView) this.rafView = requestAnimationFrame(() => { this.rafView = 0; this.renderAll(); });
    } else {
      const a = this.rendered, b = this.view;
      const k = b.s / a.s;
      this.layers.style.transform = `translate(${b.x - a.x * k}px,${b.y - a.y * k}px) scale(${k})`;
      clearTimeout(this.viewTimer);
      this.viewTimer = setTimeout(() => this.renderAll(), 140);
      this.invalidateLive();
    }
  }

  toPage(e) {
    const r = this.rect || (this.rect = this.root.getBoundingClientRect());
    return { x: (e.clientX - r.left - this.view.x) / this.view.s, y: (e.clientY - r.top - this.view.y) / this.view.s };
  }

  // ---------- conteúdo ----------

  setPage(page, paper, keepView) {
    const changed = !this.page || this.page.id !== (page && page.id) || this.page.w !== page.w || this.page.h !== page.h;
    this.page = page;
    this.paper = paper || null;
    this.hidden.clear();
    this.liveStrokes.clear();
    this.lasso = null;
    this.selection = null;
    if (changed) { this.laser = []; this.laserDown = false; }
    if (page && page.bg && !page.bgImg) {
      const e = loadImage(page.bg);
      if (e.img) page.bgImg = e.img;
      else e.promise.then((im) => { if (im && this.page === page) { page.bgImg = im; this.renderBg(); } });
    }
    if (page && (changed || !keepView)) this.fitView();
    else this.renderAll();
  }

  setPaper(paper) { this.paper = paper; this.renderBg(); }

  transform(ctx) {
    const d = this.dpr, v = this.view;
    ctx.setTransform(d * v.s, 0, 0, d * v.s, d * v.x, d * v.y);
  }

  clear(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  // O laser vai ser usado agora: se o que estava marcado já tinha sumido
  // (ou deveria ter sumido), começa do zero.
  laserBegin() {
    const now = performance.now();
    const down = this.laserDown && now - this.laserAt < 8000;
    if (!down && now - this.laserAt >= LASER_HOLD + LASER_FADE) this.laser = [];
    this.laserAt = now;
  }

  // Onde ficam as alças da seleção: `rz` (canto, muda o tamanho) e `rot`
  // (bolinha que gira; fica acima da seleção, ou abaixo se não couber).
  selHandles() {
    const sel = this.selection;
    if (!sel) return null;
    const px = 1 / this.view.s, b = sel.box, v = this.visibleRect();
    const cx = (b[0] + b[2]) / 2, gap = 30 * px;
    const above = b[1] - gap >= v[1] + 130 * px || b[3] + gap > v[3] - 80 * px;
    return { rz: [b[2], b[3]], rot: [cx, above ? b[1] - gap : b[3] + gap], stem: [cx, above ? b[1] : b[3]] };
  }

  visibleRect() {
    const v = this.view;
    return [-v.x / v.s, -v.y / v.s, (this.W - v.x) / v.s, (this.H - v.y) / v.s];
  }

  renderAll() {
    const t0 = performance.now();
    clearTimeout(this.viewTimer);
    this.renderBg();
    this.renderInk();
    this.drawLive();
    this.rendered = { ...this.view };
    this.layers.style.transform = "";
    this.rect = this.root.getBoundingClientRect();
    this.fast = performance.now() - t0 < 9;
  }

  renderBg() {
    const ctx = this.xBg, p = this.page;
    this.clear(ctx);
    if (!p) return;
    this.transform(ctx);
    ctx.save();
    ctx.shadowColor = "rgba(20,33,61,.16)";
    ctx.shadowBlur = 22 * this.dpr;
    ctx.shadowOffsetY = 5 * this.dpr;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, p.w, p.h);
    ctx.restore();
    drawPaper(ctx, p, null, 1 / (this.dpr * this.view.s));
    // linhas do papel: camada à parte, só para quem escreve
    const xp = this.xPaper;
    this.clear(xp);
    if (!this.readonly && this.paper) {
      this.transform(xp);
      drawPaper(xp, p, this.paper, 1 / (this.dpr * this.view.s), true);
    }
    if (p.bgImg) ctx.drawImage(p.bgImg, 0, 0, p.w, p.h);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, p.w, p.h); ctx.clip();
    drawImages(ctx, this.visibleItems(), (it) => this.getImg(it));
    ctx.restore();
  }

  getImg(it) {
    if (!it.src) return null;
    const e = loadImage(it.src);
    if (e.img) return e.img;
    e.promise.then(() => {
      if (this.bgSoon) return;
      this.bgSoon = requestAnimationFrame(() => { this.bgSoon = 0; this.renderBg(); this.invalidateLive(); });
    });
    return null;
  }

  visibleItems() {
    const p = this.page;
    if (!p) return [];
    return this.hidden.size ? p.items.filter((it) => !this.hidden.has(it.id)) : p.items;
  }

  renderInk() {
    const p = this.page;
    const items = this.visibleItems();
    const rect = this.visibleRect();
    for (const [ctx, kind] of [[this.xHl, "hl"], [this.xInk, "pen"]]) {
      this.clear(ctx);
      if (!p) continue;
      this.transform(ctx);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, p.w, p.h); ctx.clip();
      drawStrokes(ctx, items, kind, rect); // o marca-texto fica translúcido pelo CSS da camada
      ctx.restore();
    }
  }

  // Acrescenta um traço pronto sem redesenhar a página inteira.
  commitStroke(s) {
    const p = this.page;
    this.liveStrokes.delete(s.id);
    if (!this.fast && this.layers.style.transform) { this.renderAll(); return; }
    const ctx = s.t === "hl" ? this.xHl : this.xInk;
    this.transform(ctx);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, p.w, p.h); ctx.clip();
    ctx.fillStyle = s.c;
    fillStroke(ctx, s);
    ctx.restore();
    this.drawLive();
  }

  // ---------- camada ao vivo (traço em andamento, laser, seleção) ----------

  invalidateLive() {
    if (!this.rafLive) this.rafLive = requestAnimationFrame(() => { this.rafLive = 0; this.drawLive(); });
  }

  drawLive() {
    const ctx = this.xLive, p = this.page;
    this.clear(ctx);
    if (!p) return;
    this.transform(ctx);
    const px = 1 / this.view.s;

    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, p.w, p.h); ctx.clip();
    for (const s of this.liveStrokes.values()) {
      if (!s.p.length) continue;
      ctx.globalAlpha = s.t === "hl" ? HL_ALPHA : 1;
      ctx.fillStyle = s.c;
      fillStroke(ctx, { t: s.t, w: s.w, p: s.p, g: s.g, d: s.d, dn: s.dn }, s.t === "hl");
    }
    ctx.globalAlpha = 1;

    const sel = this.selection;
    const m = sel && sel.m;
    const k = (m && m.k) || 1;
    // o que está sendo movido, girado ou redimensionado acompanha a caneta
    const moving = () => {
      if (!m) return;
      ctx.translate((m.dx || 0) + (m.ox || 0), (m.dy || 0) + (m.oy || 0));
      ctx.rotate(m.rot || 0);
      ctx.scale(k, k);
      ctx.translate(-(m.ox || 0), -(m.oy || 0));
    };
    if (sel && this.hidden.size) {
      ctx.save();
      moving();
      drawImages(ctx, sel.items, (it) => this.getImg(it));
      ctx.globalAlpha = HL_ALPHA;
      drawStrokes(ctx, sel.items, "hl", null, true);
      ctx.globalAlpha = 1;
      drawStrokes(ctx, sel.items, "pen");
      ctx.restore();
    }
    ctx.restore();

    if (sel) {
      const b = sel.box;
      ctx.save();
      moving();
      ctx.strokeStyle = "#2347d9";
      ctx.lineWidth = (1.5 * px) / k;
      ctx.setLineDash([(6 * px) / k, (4 * px) / k]);
      ctx.strokeRect(b[0], b[1], b[2] - b[0], b[3] - b[1]);
      ctx.setLineDash([]);
      ctx.restore();
      if (!m) { // alças: canto = tamanho; bolinha com seta = girar
        const hd = this.selHandles();
        ctx.strokeStyle = "#2347d9";
        ctx.lineWidth = 1.5 * px;
        ctx.beginPath(); ctx.moveTo(hd.stem[0], hd.stem[1]); ctx.lineTo(hd.rot[0], hd.rot[1]); ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(hd.rz[0], hd.rz[1], 7 * px, 0, 7); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(hd.rot[0], hd.rot[1], 10 * px, 0, 7); ctx.fill(); ctx.stroke();
        const r = 4.6 * px, a1 = -0.35;
        ctx.beginPath(); ctx.arc(hd.rot[0], hd.rot[1], r, a1 - 4.9, a1); ctx.stroke();
        const ex = hd.rot[0] + Math.cos(a1) * r, ey = hd.rot[1] + Math.sin(a1) * r;
        ctx.fillStyle = "#2347d9";
        ctx.beginPath(); ctx.moveTo(ex - 3.2 * px, ey - 1.6 * px); ctx.lineTo(ex + 2.6 * px, ey - 2.2 * px); ctx.lineTo(ex + 0.6 * px, ey + 3.4 * px); ctx.closePath(); ctx.fill();
      }
    }

    if (this.lasso && this.lasso.length >= 4) {
      ctx.beginPath();
      ctx.moveTo(this.lasso[0], this.lasso[1]);
      for (let i = 2; i < this.lasso.length; i += 2) ctx.lineTo(this.lasso[i], this.lasso[i + 1]);
      ctx.strokeStyle = "#2347d9";
      ctx.lineWidth = 1.5 * px;
      ctx.setLineDash([6 * px, 5 * px]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // laser: o que foi marcado fica na tela enquanto a pessoa continua
    // marcando; só some (tudo junto) depois de 2 s sem usar o laser
    if (this.laser.length) {
      const now = performance.now();
      const down = this.laserDown && now - this.laserAt < 8000;
      const idle = down ? 0 : now - this.laserAt;
      clearTimeout(this.laserTimer);
      if (idle >= LASER_HOLD + LASER_FADE) this.laser = [];
      else {
        const alpha = idle <= LASER_HOLD ? 1 : 1 - (idle - LASER_HOLD) / LASER_FADE;
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.strokeStyle = `rgba(229,56,59,${0.85 * alpha})`;
        ctx.lineWidth = 5 * px;
        ctx.beginPath();
        for (let i = 0; i < this.laser.length; i++) {
          const q = this.laser[i];
          if (i === 0 || q.brk) { ctx.moveTo(q.x, q.y); ctx.lineTo(q.x, q.y); } else ctx.lineTo(q.x, q.y);
        }
        ctx.stroke();
        const last = this.laser[this.laser.length - 1];
        if (down || idle < 700) {
          ctx.fillStyle = "rgba(229,56,59,.95)";
          ctx.beginPath(); ctx.arc(last.x, last.y, 5 * px, 0, 7); ctx.fill();
        }
        if (idle > LASER_HOLD) this.invalidateLive(); // sumindo
        else { // parado: redesenha quando o ponteiro apaga e quando começa a sumir
          const wait = down ? 1000 : idle < 700 ? 700 - idle : LASER_HOLD - idle;
          this.laserTimer = setTimeout(() => this.invalidateLive(), wait + 20);
        }
      }
    }

    if (this.cursor) {
      ctx.strokeStyle = "rgba(20,33,61,.55)";
      ctx.lineWidth = 1.2 * px;
      ctx.beginPath(); ctx.arc(this.cursor.x, this.cursor.y, this.cursor.r, 0, 7); ctx.stroke();
    }
  }

  // ---------- entrada ----------

  activeTouches() {
    const out = [];
    for (const t of this.touches.values()) if (!t.ignore) out.push(t);
    return out;
  }

  startGesture() {
    const a = this.activeTouches();
    if (a.length === 0) { this.gesture = null; return; }
    const view0 = this.gesture && this.gesture.view0 ? this.gesture.view0 : { ...this.view };
    if (a.length === 1) {
      this.gesture = { type: "pan", lx: a[0].x, ly: a[0].y, x0: a[0].x, y0: a[0].y, t0: performance.now(), moved: false, view0 };
    } else {
      const r = this.rect;
      const mx = (a[0].x + a[1].x) / 2 - r.left, my = (a[0].y + a[1].y) / 2 - r.top;
      this.gesture = {
        type: "pinch", d0: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1, s0: this.view.s,
        px: (mx - this.view.x) / this.view.s, py: (my - this.view.y) / this.view.s, view0,
      };
    }
  }

  canDrawWith(e) {
    if (this.readonly || !this.tool || this.handMode()) return false;
    if (e.pointerType === "mouse") return e.button === 0 && !this.spaceDown;
    if (e.pointerType === "touch") return this.fingerDraw();
    return true;
  }

  // Um toque que chega enquanto a caneta escreve (ou no instante seguinte)
  // é a mão apoiada, não um gesto.
  isPalm() {
    if (this.readonly || !this.penMode() || this.handMode()) return false;
    if (this.draw && this.draw.type === "pen") return true;
    return performance.now() - this.lastPen < 350;
  }

  // Com caneta, um dedo sozinho não move a folha (só dois dedos, ou a mão).
  oneFingerLocked() {
    return !this.readonly && this.penMode() && !this.handMode();
  }

  // Encerra o traço em andamento (se houver) guardando o que já foi escrito.
  finishDraw(discard) {
    const d = this.draw;
    if (!d) return;
    this.draw = null;
    if (discard) this.tool.cancel(); else this.tool.end();
  }

  onDown(e) {
    if (e.pointerType === "mouse" && e.button === 2) return;
    this.rect = this.root.getBoundingClientRect();
    try { this.root.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();

    if (e.pointerType === "touch") {
      const t = { id: e.pointerId, x: e.clientX, y: e.clientY, ignore: this.isPalm() };
      this.touches.set(e.pointerId, t);
      this.stats.last = "toque";
      if (t.ignore) { this.stats.palm++; return; }
      this.stats.finger++;
      if (this.draw && this.draw.type === "touch") { // segundo dedo: vira zoom/arrasto
        this.finishDraw(true);
        this.startGesture();
        return;
      }
      if (this.activeTouches().length === 1 && this.canDrawWith(e)) {
        this.draw = { id: e.pointerId, type: "touch" };
        this.tool.start(this.toPage(e), e);
        return;
      }
      this.startGesture();
      return;
    }

    if (e.pointerType === "pen") {
      this.stats.pen++;
      this.stats.last = "caneta";
      this.onPen();
      if (!this.handMode() && !this.readonly) {
        this.lastPen = performance.now();
        // palma apoiada: ignora os toques que já estavam na tela e desfaz
        // qualquer deslocamento que eles tenham causado na página
        for (const t of this.touches.values()) t.ignore = true;
        const g = this.gesture;
        this.gesture = null;
        if (g && g.view0) this.setView(g.view0);
      }
    }
    // Se um traço anterior ficou "preso" (o navegador não avisou que a caneta
    // levantou), ele é encerrado aqui e o novo traço começa normalmente.
    if (this.draw) this.finishDraw(this.draw.type === "touch");
    if (!this.canDrawWith(e)) {
      this.gesture = { type: "drag", id: e.pointerId, lx: e.clientX, ly: e.clientY };
      this.root.classList.add("grabbing");
      return;
    }
    this.draw = { id: e.pointerId, type: e.pointerType };
    this.tool.start(this.toPage(e), e);
  }

  onMove(e) {
    if (this.draw && e.pointerId === this.draw.id) {
      if (this.draw.type === "pen") this.lastPen = performance.now();
      const list = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
      const pts = [];
      for (const ev of list) {
        // alguns navegadores entregam eventos intermediários sem posição,
        // repetidos ou fora de ordem: esses ficam de fora
        if (ev.clientX === 0 && ev.clientY === 0 && (e.clientX !== 0 || e.clientY !== 0)) continue;
        const ts = ev.timeStamp || 0;
        if (ts && ts < this.lastTs) continue;
        if (ts) this.lastTs = ts;
        const p = this.toPage(ev);
        p.pr = ev.pressure; p.t = ts || e.timeStamp;
        pts.push(p);
      }
      if (!pts.length) {
        const p = this.toPage(e);
        p.pr = e.pressure; p.t = e.timeStamp;
        if (e.timeStamp) this.lastTs = e.timeStamp;
        pts.push(p);
      }
      this.tool.move(pts, e);
      return;
    }
    if (e.pointerType === "touch") {
      const t = this.touches.get(e.pointerId);
      if (!t) return;
      t.x = e.clientX; t.y = e.clientY;
      if (t.ignore || !this.gesture) return;
      const g = this.gesture;
      const a = this.activeTouches();
      if (g.type === "pan") {
        if (this.oneFingerLocked()) return;
        if (!g.moved) { // só começa a arrastar depois de um movimento claro
          if (Math.hypot(t.x - g.x0, t.y - g.y0) < 8) return;
          g.moved = true; g.lx = t.x; g.ly = t.y;
          return;
        }
        const dx = t.x - g.lx, dy = t.y - g.ly;
        g.lx = t.x; g.ly = t.y;
        this.setView({ s: this.view.s, x: this.view.x + dx, y: this.view.y + dy }, true);
      } else if (g.type === "pinch" && a.length >= 2) {
        const r = this.rect;
        const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1;
        const mx = (a[0].x + a[1].x) / 2 - r.left, my = (a[0].y + a[1].y) / 2 - r.top;
        if (!g.moved) { // dois toques parados (palma + dedo mínimo) não mexem na folha
          if (g.mx0 === undefined) { g.mx0 = mx; g.my0 = my; }
          const slack = this.oneFingerLocked() ? 12 : 3;
          if (Math.abs(d - g.d0) < slack && Math.hypot(mx - g.mx0, my - g.my0) < slack) return;
          g.moved = true;
          g.d0 = d; g.s0 = this.view.s;
          g.px = (mx - this.view.x) / this.view.s; g.py = (my - this.view.y) / this.view.s;
          return;
        }
        const s = g.s0 * (d / g.d0);
        this.setView({ s, x: mx - g.px * s, y: my - g.py * s }, true);
        const s2 = this.view.s;
        if (s2 !== s) this.setView({ s: s2, x: mx - g.px * s2, y: my - g.py * s2 }, true);
      }
      return;
    }
    if (this.gesture && this.gesture.type === "drag" && e.pointerId === this.gesture.id) {
      const g = this.gesture;
      this.setView({ s: this.view.s, x: this.view.x + e.clientX - g.lx, y: this.view.y + e.clientY - g.ly }, true);
      g.lx = e.clientX; g.ly = e.clientY;
      return;
    }
    if (this.tool && this.tool.hover && !this.readonly && e.pointerType !== "touch") this.tool.hover(this.toPage(e));
  }

  onUp(e) {
    try { this.root.releasePointerCapture(e.pointerId); } catch {}
    if (e.pointerType === "pen" && this.draw && this.draw.type === "pen") this.lastPen = performance.now();
    if (this.draw && e.pointerId === this.draw.id) {
      if (e.type === "pointercancel" && this.draw.type === "pen") this.stats.cut++;
      // Se o sistema interromper a caneta no meio, o que foi escrito fica.
      // Só o traço de dedo interrompido é descartado (costuma ser gesto do sistema).
      this.finishDraw(e.type === "pointercancel" && this.draw.type === "touch");
    }
    if (e.pointerType === "touch") {
      const g = this.gesture;
      this.touches.delete(e.pointerId);
      if (g && g.type === "pan" && !g.moved && performance.now() - g.t0 < 260 && this.readonly) {
        const now = performance.now();
        if (now - this.lastTap < 320) { // toque duplo: aproxima ou volta
          if (this.atFit) this.zoomAt(e.clientX - this.rect.left, e.clientY - this.rect.top, 2.2);
          else this.fitView();
          this.lastTap = 0;
        } else this.lastTap = now;
      }
      if (this.activeTouches().length === 0) this.gesture = null;
      this.startGesture();
      return;
    }
    if (this.gesture && this.gesture.type === "drag" && e.pointerId === this.gesture.id) {
      this.gesture = null;
      this.root.classList.remove("grabbing");
    }
  }

  onWheel(e) {
    e.preventDefault();
    if (!this.page) return;
    this.rect = this.root.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) {
      this.zoomAt(e.clientX - this.rect.left, e.clientY - this.rect.top, Math.exp(-e.deltaY * 0.01));
    } else {
      const k = e.deltaMode === 1 ? 32 : 1;
      this.setView({ s: this.view.s, x: this.view.x - e.deltaX * k, y: this.view.y - e.deltaY * k }, true);
    }
  }
}

export { bbox };
