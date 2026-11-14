// Estúdio: o editor do Traço como ele é, com o que o estúdio precisa por cima (o editor em si não muda).
//
// - Tudo o que se escreve é gravado no servidor da live (store.saveItems) e vai na hora para os outros
//   aparelhos do estúdio pelo canal direto (a "ponte" da página do estúdio), como na transmissão do Traço:
//     sp = traço em andamento, sx = traço cancelado, lz = laser, vw = enquadramento, cur = página aberta,
//     op = alteração definitiva, nb = caderno (páginas, papel, nome).
// - O menu "+" ganha os PDFs da aula e os cadernos da live.

import { Editor } from "./editor.js";
import * as ink from "./ink.js";
import * as store from "./store.js";
import { h, esc, icon, toast, modal, popover } from "./ui.js";

const BIG = 180_000; // imagem maior que isto não vai pelo canal direto (o outro aparelho busca no servidor)

export class StudioEditor extends Editor {
  constructor(root, nb, opts) {
    super(root, nb, opts);
    this.bridge = opts.bridge || null;
    this.materials = opts.materials || [];
    this.nbKey = this.nbSig();
    // enquadramento: só o que a pessoa mexeu vai para os outros (o que veio de fora não volta)
    this.board.onView = (v, user) => { if (user) this.viewChanged(); };
  }

  // estúdio: tela cheia e voltar são os do estúdio (o caderno fica dentro dele)
  action(a, btn) {
    if (a === "full" && this.bridge && this.bridge.full) { this.bridge.full(); return; }
    super.action(a, btn);
  }

  send(m) {
    if (this.bridge && !this.dead) this.bridge.send(m);
  }

  // ---------- alterações definitivas ----------

  sendOp(pg, d, p) {
    super.sendOp(pg, d, p);
    store.saveItems(pg, d, p);
    // imagem pesada: vai sem a imagem; o outro aparelho busca a página no servidor
    let big = false;
    const lite = p.map((it) => {
      if (it.k === "i" && it.src && it.src.length > BIG) { big = true; return { ...it, src: undefined, big: 1 }; }
      return it;
    });
    this.send({ k: "op", pg, d, p: lite, big: big ? 1 : 0 });
  }

  // ---------- caderno e páginas ----------

  nbSig() {
    const n = this.nb;
    return JSON.stringify([n.name, n.paper, n.orient, n.pages]);
  }
  saveNb() {
    const out = super.saveNb();
    const key = this.nbSig();
    if (key !== this.nbKey) {
      this.nbKey = key;
      const metas = [];
      for (const id of this.nb.pages) {
        const p = this.pages.get(id);
        if (p) metas.push({ id: p.id, nb: p.nb, w: p.w, h: p.h, bgRef: p.bgRef || null });
      }
      this.send({ k: "nb", nb: { id: this.nb.id, name: this.nb.name, paper: this.nb.paper, orient: this.nb.orient, pages: this.nb.pages }, metas });
      this.bridge && this.bridge.changed && this.bridge.changed(this.nb);
    }
    return out;
  }

  // páginas novas: em branco ou de um PDF (com o fundo por referência ao arquivo da aula)
  async addPages(list, at, quiet) {
    const made = [];
    for (const src of list) {
      const p = { id: ink.uid(), nb: this.nb.id, w: src.w, h: src.h, items: [], hasBg: !!(src.bg || src.bgRef) };
      if (src.bg) p.bg = src.bg;
      if (src.bgRef) p.bgRef = src.bgRef;
      store.knowPage({ id: p.id, nb: p.nb, w: p.w, h: p.h, bgRef: p.bgRef || null });
      await store.putPage(p, true);
      if (p.bgRef && !p.bg) p.bg = await store.bgFor(p.bgRef).catch(() => undefined);
      this.pages.set(p.id, p);
      made.push(p);
    }
    this.nb.pages.splice(at, 0, ...made.map((p) => p.id));
    if (at <= this.index && this.page) this.index += made.length;
    await this.saveNb();
    if (!quiet) this.updatePager();
    this.trimPages();
    return made;
  }

  async go(i, force) {
    const before = this.page;
    // avisa os outros aparelhos já (eles começam a abrir a página ao mesmo tempo que este)
    const target = this.nb.pages[Math.min(this.nb.pages.length - 1, Math.max(0, i))];
    const early = !this.quiet && !this.act && target && (!before || before.id !== target);
    if (early) this.send({ k: "cur", nb: this.nb.id, id: target });
    await super.go(i, force);
    if (this.page && this.page !== before && !this.quiet) {
      if (!early || this.page.id !== target) this.send({ k: "cur", nb: this.nb.id, id: this.page.id });
      // também pela cena da live (servidor): se a mensagem direta se perder, os aparelhos se acertam assim mesmo
      this.bridge && this.bridge.page && this.bridge.page(this.nb.id, this.page.id);
    }
    this.prefetch();
  }

  // deixa prontas as páginas vizinhas (virar a página — aqui ou em outro aparelho — fica imediato)
  prefetch() {
    clearTimeout(this.prefetchTimer);
    this.prefetchTimer = setTimeout(async () => {
      for (const d of [1, -1, 2]) {
        const id = this.nb.pages[this.index + d];
        if (!id || this.dead) continue;
        const p = this.pages.get(id);
        if (p && (!p.hasBg || p.bg)) continue;
        await this.loadPage(id).catch(() => null);
      }
    }, 300);
  }

  // alterações que chegam para uma página ainda não aberta aqui: guardadas e aplicadas quando ela abrir
  async loadPage(id) {
    const p = await super.loadPage(id);
    const pend = this.pendingOps && this.pendingOps.get(id);
    if (p && pend) {
      this.pendingOps.delete(id);
      for (const m of pend) p.items = ink.applyOp(p.items, m.d, m.p);
    }
    return p;
  }

  // PDF escolhido no aparelho: sobe para os PDFs da aula e entra no caderno (sem imagens pesadas)
  async insertPdf(file) {
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) { toast("Escolha um arquivo PDF.", { error: true }); return; }
    if (file.size > 50 * 1024 * 1024) { toast("O PDF deve ter no máximo 50 MB.", { error: true }); return; }
    const t = toast("Enviando o PDF…", { sticky: true });
    try {
      const r = await fetch("/api/storage/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "materials", folder: "lives/pdfs", contentType: "application/pdf", size: file.size }),
      });
      const up = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(up.error || "Falha no envio.");
      const put = await fetch(up.uploadUrl, { method: "PUT", headers: up.headers, body: file });
      if (!put.ok) throw new Error("Falha ao enviar o arquivo.");
      const size = file.size > 1048576 ? (file.size / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.ceil(file.size / 1024) + " KB";
      await store.api({ op: "addpdf", file: { title: file.name.replace(/\.pdf$/i, ""), path: up.path, size } });
      this.materials = [...this.materials, { id: up.path, title: file.name.replace(/\.pdf$/i, ""), path: up.path }];
      t.update("Abrindo o PDF…");
      await this.insertPdfPath(up.path, t);
    } catch (e) {
      t.close();
      toast(e && e.message ? e.message : "Não foi possível ler esse PDF.", { error: true, ms: 6000 });
    }
  }
  async insertPdfPath(path, t0) {
    const t = t0 || toast("Abrindo o PDF…", { sticky: true });
    try {
      const list = await store.pdfPages(path);
      const at = this.index + 1;
      await this.addPages(list, at, true);
      t.close();
      toast(list.length === 1 ? "1 página adicionada." : `${list.length} páginas adicionadas.`);
      await this.go(at, true);
    } catch (e) {
      t.close();
      console.error(e);
      toast("Não foi possível ler esse PDF. Ele pode estar protegido por senha ou corrompido.", { error: true, ms: 6000 });
      this.updatePager();
    }
  }

  addMenu(btn) {
    const mats = this.materials
      .map((m, i) => `<button data-mat="${i}">${icon("pdf", 20)}<span>${esc(m.title)} <small class="muted">(PDF da aula)</small></span></button>`)
      .join("");
    const el = h(`<div class="menu">
      <button data-m="blank">${icon("paper", 20)}<span>Página nova</span></button>
      <button data-m="image">${icon("image", 20)}<span>Imagem nesta página</span></button>
      <button data-m="pdf">${icon("pdf", 20)}<span>PDF inteiro, depois desta página</span></button>
      ${mats}
      <button data-m="nbs">${icon("pages", 20)}<span>Cadernos da aula</span></button>
    </div>`);
    const pop = popover(btn, el);
    el.addEventListener("click", async (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      pop.close();
      if (b.dataset.mat) { const m = this.materials[+b.dataset.mat]; if (m) this.insertPdfPath(m.path); }
      else if (b.dataset.m === "blank") { await this.addPages([this.blankSize()], this.index + 1); this.go(this.index + 1); }
      else if (b.dataset.m === "image") this.fImage.click();
      else if (b.dataset.m === "pdf") this.fPdf.click();
      else if (b.dataset.m === "nbs") this.notebooks();
    });
  }

  // cadernos da aula: abrir outro, criar um novo (em branco ou com um PDF da aula)
  async notebooks() {
    const m = modal(`<div class="drawer-head"><h2>Cadernos da aula</h2><button class="ib" data-close aria-label="Fechar">${icon("x")}</button></div>
      <div class="menu" data-list><p class="muted">Carregando…</p></div>`, { cls: "is-small" });
    const list = m.el.querySelector("[data-list]");
    let nbs = [];
    try { nbs = await store.listNotebooks(); } catch {}
    list.innerHTML =
      nbs.map((n) => `<button data-open="${esc(n.id)}">${icon("pages", 20)}<span>${esc(n.name)}${n.id === this.nb.id ? ' <small class="muted">(aberto)</small>' : ""}</span></button>`).join("") +
      `<button data-new="1">${icon("plus", 20)}<span>Novo caderno em branco</span></button>` +
      this.materials.map((mt, i) => `<button data-newpdf="${i}">${icon("pdf", 20)}<span>Novo caderno com ${esc(mt.title)}</span></button>`).join("");
    list.addEventListener("click", async (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      m.close();
      if (b.dataset.open) { if (b.dataset.open !== this.nb.id) this.bridge && this.bridge.open(b.dataset.open); }
      else if (b.dataset.new) this.bridge && this.bridge.create({ name: `Caderno ${nbs.length + 1}` });
      else if (b.dataset.newpdf) { const mt = this.materials[+b.dataset.newpdf]; this.bridge && this.bridge.create({ name: mt.title, pdf: mt.path }); }
    });
  }

  // ---------- ao vivo (como na transmissão do Traço) ----------

  toolStart(pt, e) {
    super.toolStart(pt, e);
    const a = this.act;
    if (a && a.tool === "laser") { a.pend = [ink.r1(pt.x), ink.r1(pt.y)]; a.first = true; a.lz = 0; }
    if (a && (a.tool === "pen" || a.tool === "hl")) a.sent = 0;
  }
  toolMove(pts, e) {
    super.toolMove(pts, e);
    const a = this.act;
    if (a && a.tool === "laser") for (const p of pts) a.pend.push(ink.r1(p.x), ink.r1(p.y));
  }
  toolEnd(cancel) {
    const a = this.act;
    if (a && a.tool === "laser") this.liveTickFor(a, true);
    super.toolEnd(cancel);
    if (!a) return;
    if ((a.tool === "pen" || a.tool === "hl" || a.tool === "shape") && (cancel || (a.tool === "shape" && a.s.p.length < 6))) this.send({ k: "sx", id: a.s.id });
  }
  liveTickFor(a, ending) {
    super.liveTickFor(a);
    if (!this.bridge) return;
    if (a.tool === "pen" || a.tool === "hl") {
      const n = a.s.p.length / 3;
      if (n > a.sent) { this.send({ k: "sp", pg: a.pg, id: a.s.id, t: a.s.t, c: a.s.c, w: a.s.w, p: a.s.p.slice(a.sent * 3) }); a.sent = n; }
    } else if (a.tool === "shape" && a.changed) {
      this.send({ k: "sp", pg: a.pg, id: a.s.id, t: "pen", c: a.s.c, w: a.s.w, r: 1, g: 1, d: a.s.d, dn: a.s.dn, p: a.s.p });
      a.changed = false;
    } else if (a.tool === "laser") {
      const now = performance.now();
      if (a.pend.length || ending) { this.send({ k: "lz", pg: a.pg, n: a.first ? 1 : 0, p: a.pend, e: ending ? 1 : 0 }); a.pend = []; a.first = false; a.lz = now; }
      else if (now - a.lz > 600) { this.send({ k: "lz", pg: a.pg, n: 0, p: [] }); a.lz = now; }
    }
  }

  viewChanged() {
    if (this.viewTimer) return;
    this.viewTimer = setTimeout(() => {
      this.viewTimer = 0;
      const r = this.board.viewRect();
      if (r && this.page) this.send({ k: "vw", pg: this.page.id, r: r.map(ink.r1) });
    }, 60);
  }

  // ---------- o que chega dos outros aparelhos ----------

  async remote(m) {
    if (!m || this.dead) return;
    const b = this.board;
    if (m.k === "nb") {
      if (!m.nb || m.nb.id !== this.nb.id) return;
      for (const meta of m.metas || []) store.knowPage(meta);
      const paperChanged = JSON.stringify(m.nb.paper) !== JSON.stringify(this.nb.paper);
      Object.assign(this.nb, { name: m.nb.name, paper: m.nb.paper, orient: m.nb.orient, pages: m.nb.pages });
      this.nbKey = this.nbSig();
      const t = this.root.querySelector(".bar-title");
      if (t) t.textContent = this.nb.name;
      if (paperChanged) b.setPaper(this.nb.paper);
      const i = this.page ? this.nb.pages.indexOf(this.page.id) : -1;
      if (i < 0 && this.nb.pages.length) { this.quiet = true; await this.go(Math.min(this.index, this.nb.pages.length - 1), true); this.quiet = false; }
      else { this.index = i; this.updatePager(); }
      return;
    }
    if (m.k === "cur") {
      if (m.nb !== this.nb.id) { this.bridge && this.bridge.open(m.nb); return; }
      const i = this.nb.pages.indexOf(m.id);
      if (i >= 0 && (!this.page || this.page.id !== m.id)) { this.quiet = true; await this.go(i, true); this.quiet = false; }
      return;
    }
    if (m.k === "op") {
      const p = this.pages.get(m.pg);
      if (!p) {
        (this.pendingOps ||= new Map());
        const list = this.pendingOps.get(m.pg) || [];
        list.push(m);
        this.pendingOps.set(m.pg, list.slice(-500));
        return;
      }
      for (const it of m.p || []) {
        // imagem que só mudou de lugar ou que é pesada: a imagem é a que já está aqui (ou vem do servidor)
        if (it.k === "i" && !it.src) {
          const old = p.items.find((x) => x.id === it.id);
          if (old && old.src) it.src = old.src;
          delete it.big;
        }
      }
      p.items = ink.applyOp(p.items, m.d, m.p);
      if (m.big) setTimeout(() => this.refetch(m.pg), 2500);
      if (p !== this.page) return;
      const put = m.p || [];
      if (!(m.d && m.d.length) && put.length === 1 && put[0].k === "s") b.commitStroke(put[0]);
      else {
        for (const it of put) b.liveStrokes.delete(it.id);
        b.renderBg(); b.renderInk(); b.drawLive();
      }
      return;
    }
    if (m.k === "vw") {
      if (!this.page || m.pg !== this.page.id || !Array.isArray(m.r) || m.r.length !== 4) return;
      const v = b.rectView(m.r);
      if (v) b.setView(v);
      return;
    }
    if (m.pg && (!this.page || m.pg !== this.page.id)) return;
    if (m.k === "sp") {
      let s = b.liveStrokes.get(m.id);
      if (!s) { s = { id: m.id, t: m.t, c: m.c, w: m.w, p: [] }; b.liveStrokes.set(m.id, s); }
      s.g = m.g; s.d = m.d; s.dn = m.dn;
      if (m.r) s.p = m.p; else for (const v of m.p) s.p.push(v);
    } else if (m.k === "sx") {
      b.liveStrokes.delete(m.id);
    } else if (m.k === "lz") {
      const pts = Array.isArray(m.p) ? m.p : [];
      b.laserBegin();
      for (let i = 0; i < pts.length; i += 2) b.laser.push({ x: pts[i], y: pts[i + 1], brk: m.n && i === 0 });
      b.laserDown = !m.e;
      if (m.e) b.laserAt = performance.now();
    }
    b.invalidateLive();
  }

  async refetch(pg) {
    const fresh = await store.getPage(pg).catch(() => null);
    const p = this.pages.get(pg);
    if (!fresh || !p) return;
    p.items = fresh.items;
    if (p === this.page) { this.board.renderBg(); this.board.renderInk(); this.board.drawLive(); }
  }

  // camadas da folha, para a imagem da live (papel → câmera → marca-texto → tinta → ao vivo)
  layers() {
    const b = this.board;
    return { bg: b.cBg, hl: b.cHl, ink: b.cInk, live: b.cLive, camSlot: b.camSlot, root: b.root, layers: b.layers };
  }

  async destroy() {
    await store.flush();
    await super.destroy();
  }
}
