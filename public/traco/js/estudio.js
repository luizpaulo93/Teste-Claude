// Estúdio: abre o caderno da live no editor do Traço (dentro da página do estúdio).
// A página do estúdio fala com este caderno pela "ponte" (window.parent.__tracoBridge) e pelo window.__traco.

import * as store from "./store.js";
import { StudioEditor } from "./studio.js";
import { uid } from "./ink.js";

const app = document.getElementById("app");

// A live usa a imagem da folha: com o estúdio pequeno na tela, a folha é desenhada com mais pontos (até 1600
// de largura), para a live sair nítida. Em tela cheia no iPad nada muda.
{
  const real = window.devicePixelRatio || 1;
  try {
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, get: () => Math.min(3, Math.max(real, 1600 / Math.max(1, window.innerWidth))) });
  } catch {}
}
const bridge = (() => { try { return window.parent !== window ? window.parent.__tracoBridge || null : null; } catch { return null; } })();
let current = null;
let materials = [];
let opening = Promise.resolve();

// Safari: nada de zoom da página inteira por gesto, nem seleção de texto com a caneta
document.addEventListener("gesturestart", (e) => e.preventDefault());
const editable = (t) => !!(t && t.closest && t.closest("input, textarea"));
for (const type of ["selectstart", "dragstart"]) document.addEventListener(type, (e) => { if (!editable(e.target)) e.preventDefault(); });
function fitApp() {
  document.documentElement.style.setProperty("--app-h", Math.round(window.innerHeight) + "px");
}
addEventListener("resize", fitApp);
fitApp();
document.body.classList.add("is-app");

async function newNotebook({ name, pdf }) {
  const nb = { id: uid(), owner: "live", name: name || "Caderno", color: "#2347d9", paper: { type: "blank", size: 40 }, orient: "p", pages: [], updated: Date.now() };
  if (pdf) {
    const list = await store.pdfPages(pdf);
    for (const src of list) {
      const id = uid();
      store.knowPage({ id, nb: nb.id, w: src.w, h: src.h, bgRef: src.bgRef });
      await store.putPage({ id, nb: nb.id, w: src.w, h: src.h, bgRef: src.bgRef, items: [] });
      nb.pages.push(id);
    }
  }
  await store.putNotebook(nb);
  return nb;
}

async function open(id) {
  opening = opening.then(async () => {
    if (current && current.nb.id === id) return;
    if (current) { const c = current; current = null; await c.destroy(); }
    let nb = id ? await store.getNotebook(id).catch(() => null) : null;
    if (!nb) {
      // o caderno mais recente da aula; se não houver, um novo (com o primeiro PDF da aula, se houver)
      const boot = await store.boot().catch(() => ({ nbs: [] }));
      materials = boot.materials || materials;
      const last = (boot.nbs || [])[0];
      nb = last ? await store.getNotebook(last.id) : await newNotebook(materials[0] ? { name: materials[0].title, pdf: materials[0].path } : { name: "Caderno 1" });
    }
    if (!materials.length) materials = (await store.boot().catch(() => ({}))).materials || [];
    current = new StudioEditor(app, nb, {
      onExit: () => bridge && bridge.exit && bridge.exit(),
      bridge: bridge && {
        send: (m) => bridge.send(m),
        changed: (n) => bridge.changed && bridge.changed(n),
        full: () => bridge.full && bridge.full(),
        page: (nid, pid) => bridge.page && bridge.page(nid, pid),
        open: (nid) => { open(nid); },
        create: async (o) => { const n = await newNotebook(o); open(n.id); },
      },
      materials,
    });
    bridge && bridge.opened && bridge.opened(nb.id, nb.name);
  });
  return opening;
}

// vai para uma página (o caderno pode ter ganhado páginas em outro aparelho: busca o caderno de novo)
async function goPage(nid, pid) {
  if (!current || current.nb.id !== nid) await open(nid);
  const ed = current;
  if (!ed || ed.dead || (ed.page && ed.page.id === pid)) return;
  if (!ed.nb.pages.includes(pid)) {
    const r = await store.api({ op: "getnb", id: nid }).catch(() => null);
    if (r && r.nb && r.nb.pages) { ed.nb.pages = r.nb.pages; ed.nbKey = ed.nbSig(); }
  }
  const i = ed.nb.pages.indexOf(pid);
  if (i < 0) return;
  ed.quiet = true;
  try { await ed.go(i, true); } finally { ed.quiet = false; }
}

window.__traco = {
  open,
  goPage,
  newNotebook,
  editor: () => current,
  notebook: () => (current ? current.nb.id : null),
  remote: (m) => current && current.remote(m),
  layers: () => (current ? current.layers() : null),
  flush: () => store.flush(),
  materials: (list) => { materials = list; if (current) current.materials = list; },
};
const want = new URLSearchParams(location.search).get("nb");
if (bridge && bridge.attach) bridge.attach(window.__traco);
open(want || (bridge && bridge.notebook && bridge.notebook()) || null);
