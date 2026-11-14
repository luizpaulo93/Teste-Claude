// Estúdio: abre o caderno da live no editor do Traço (dentro da página do estúdio).
// A página do estúdio fala com este caderno pela "ponte" (window.parent.__tracoBridge) e pelo window.__traco.

import * as store from "./store.js";
import { StudioEditor } from "./studio.js";
import { uid } from "./ink.js";

const app = document.getElementById("app");
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
        open: (nid) => { open(nid); },
        create: async (o) => { const n = await newNotebook(o); open(n.id); },
      },
      materials,
    });
    bridge && bridge.opened && bridge.opened(nb.id, nb.name);
  });
  return opening;
}

window.__traco = {
  open,
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
