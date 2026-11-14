// Estúdio: cadernos guardados no servidor da live (em vez do IndexedDB do aparelho), para todos os aparelhos
// do estúdio abrirem o mesmo caderno e nada se perder. Mesmas funções do store.js do Traço.
//
// - Caderno e páginas (tamanho, fundo) são gravados aqui.
// - O que se escreve (traços, imagens) é gravado item por item em `saveItems` (chamado a cada alteração).
// - Páginas de PDF guardam só a referência ao arquivo da aula ({ path, n }); cada aparelho desenha a página
//   a partir do PDF (nada de imagens pesadas indo e voltando).

export const MAX_NOTEBOOKS = 1000;
export const live = new URLSearchParams(location.search).get("live") || "";

async function api(body, tries = 3) {
  for (let k = 0; ; k++) {
    const res = await fetch("/api/traco", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ live, ...body }) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (res && res.ok) return data;
    if (k >= tries - 1 || (res && (res.status === 400 || res.status === 403))) throw new Error(data.error || "Falha ao salvar.");
    await new Promise((r) => setTimeout(r, 700 * (k + 1)));
  }
}
export { api };

// ---------- cadernos ----------

const nbs = new Map();
export async function boot() {
  return api({ op: "boot" });
}
export async function getNotebook(id) {
  if (nbs.has(id)) return nbs.get(id);
  const r = await api({ op: "getnb", id });
  if (r.nb) nbs.set(id, r.nb);
  return r.nb || null;
}
const nbTimers = new Map();
export function putNotebook(nb) {
  nbs.set(nb.id, nb);
  clearTimeout(nbTimers.get(nb.id));
  return new Promise((resolve) => {
    nbTimers.set(nb.id, setTimeout(() => {
      nbTimers.delete(nb.id);
      api({ op: "putnb", nb: { id: nb.id, name: nb.name, paper: nb.paper, orient: nb.orient, pages: nb.pages } }).catch(() => {}).finally(resolve);
    }, 250));
  });
}
export async function deleteNotebook(id) {
  nbs.delete(id);
  await api({ op: "delnb", id });
}
export async function listNotebooks() {
  return (await boot()).nbs || [];
}

// ---------- páginas ----------

// medidas e fundo de cada página (para quem abre a página antes de o servidor ter gravado)
const metas = new Map();
export function knowPage(meta) {
  metas.set(meta.id, { ...metas.get(meta.id), ...meta });
}

export async function getPage(id) {
  let r;
  try { r = await api({ op: "getpage", id }); } catch { r = { page: null }; }
  const meta = r.page || metas.get(id);
  if (!meta) return null;
  const page = { id, nb: meta.nb, w: meta.w, h: meta.h, hasBg: !!meta.bgRef, items: r.items || [] };
  if (meta.bgRef) {
    page.bgRef = meta.bgRef;
    page.bg = await bgFor(meta.bgRef).catch(() => null);
    if (!page.bg) delete page.bg;
  }
  metas.set(id, { id, nb: page.nb, w: page.w, h: page.h, bgRef: page.bgRef });
  return page;
}

export async function getBg(id) {
  const m = metas.get(id);
  return m && m.bgRef ? bgFor(m.bgRef).catch(() => null) : null;
}

const saved = new Map();
export function putPage(page) {
  const meta = { id: page.id, nb: page.nb, w: page.w, h: page.h, bgRef: page.bgRef || null };
  metas.set(page.id, meta);
  const key = JSON.stringify(meta);
  if (saved.get(page.id) === key) return Promise.resolve();
  saved.set(page.id, key);
  return api({ op: "putpage", page: meta }).catch(() => { saved.delete(page.id); });
}

export async function deletePage(id) {
  metas.delete(id);
  saved.delete(id);
  await api({ op: "delpage", id }).catch(() => {});
}

// ---------- o que se escreve (item por item, juntando as alterações de ~0,4 s) ----------

const queue = new Map(); // página → { del:Set, put:Map }
let timer = 0;
let flying = Promise.resolve();
export function saveItems(pg, delIds, putItems) {
  let q = queue.get(pg);
  if (!q) queue.set(pg, (q = { del: new Set(), put: new Map() }));
  for (const id of delIds || []) { q.put.delete(id); q.del.add(id); }
  for (const it of putItems || []) { q.del.delete(it.id); q.put.set(it.id, it); }
  if (!timer) timer = setTimeout(flush, 400);
}
export function flush() {
  clearTimeout(timer);
  timer = 0;
  const jobs = [...queue.entries()];
  queue.clear();
  flying = flying.then(() =>
    Promise.all(jobs.map(([pg, q]) => api({ op: "items", pg, d: [...q.del], p: [...q.put.values()] }).catch(() => {
      // não deu: volta para a fila e tenta de novo
      saveItems(pg, [...q.del], [...q.put.values()]);
    }))),
  );
  return flying;
}
addEventListener("pagehide", () => { if (queue.size) flush(); });

// ---------- fundo das páginas de PDF ----------

let pdfjs;
async function lib() {
  if (!pdfjs) {
    pdfjs = await import("../vendor/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdf.worker.min.mjs", import.meta.url).href;
  }
  return pdfjs;
}
const docs = new Map(); // arquivo → documento aberto
export async function openPdf(path) {
  let d = docs.get(path);
  if (!d) {
    d = (async () => {
      const r = await fetch(`/api/storage/download?${new URLSearchParams({ path })}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) throw new Error(j.error || "PDF indisponível.");
      const bytes = await (await fetch(j.url)).arrayBuffer();
      const pdf = await lib();
      const base = new URL("../vendor/", import.meta.url).href;
      return pdf.getDocument({ data: bytes, cMapUrl: base + "cmaps/", cMapPacked: true, standardFontDataUrl: base + "standard_fonts/", wasmUrl: base + "wasm/" }).promise;
    })();
    docs.set(path, d);
    d.catch(() => docs.delete(path));
  }
  return d;
}
/** páginas de um PDF da aula: medidas no padrão do Traço (1000 de largura em pé, 1414 deitada) */
export async function pdfPages(path) {
  const doc = await openPdf(path);
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const v1 = (await doc.getPage(i)).getViewport({ scale: 1 });
    const w = v1.width > v1.height ? 1414 : 1000;
    out.push({ w, h: Math.round((w * v1.height) / v1.width), bgRef: { path, n: i } });
  }
  return out;
}
const bgs = new Map(); // "arquivo#página" → endereço da imagem
const bgOrder = [];
export function bgFor(ref) {
  const key = ref.path + "#" + ref.n;
  let e = bgs.get(key);
  if (e) return e;
  e = (async () => {
    const doc = await openPdf(ref.path);
    const page = await doc.getPage(ref.n);
    const v1 = page.getViewport({ scale: 1 });
    const scale = Math.min(1600 / v1.width, 2300 / v1.height);
    const vp = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, canvas, viewport: vp }).promise;
    page.cleanup();
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.86));
    canvas.width = canvas.height = 0;
    return URL.createObjectURL(blob);
  })();
  bgs.set(key, e);
  bgOrder.push(key);
  // guarda as ~40 últimas páginas desenhadas
  while (bgOrder.length > 40) {
    const old = bgOrder.shift();
    const p = bgs.get(old);
    bgs.delete(old);
    p && p.then((u) => setTimeout(() => URL.revokeObjectURL(u), 60000)).catch(() => {});
  }
  e.catch(() => bgs.delete(key));
  return e;
}

export function persist() {}
export async function oldestIfFull() { return null; }
export async function enforceLimit() { return []; }
