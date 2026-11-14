// Entrada e saída de arquivos: abrir PDF e fotos, exportar o caderno em PDF.

import { drawPageFlat, loadImage } from "./ink.js";

const MAX_DATA = 900_000; // tamanho máximo de uma imagem (cabe em uma mensagem)

let pdfjs;
async function lib() {
  if (!pdfjs) {
    pdfjs = await import("../vendor/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdf.worker.min.mjs", import.meta.url).href;
  }
  return pdfjs;
}

// Converte um canvas em JPEG que caiba no limite, reduzindo se preciso.
function toJpeg(canvas) {
  let q = 0.86;
  let c = canvas;
  for (let i = 0; i < 8; i++) {
    const url = c.toDataURL("image/jpeg", q);
    if (url.length <= MAX_DATA) return url;
    if (q > 0.6) q -= 0.13;
    else {
      const k = 0.8;
      const n = document.createElement("canvas");
      n.width = Math.round(c.width * k);
      n.height = Math.round(c.height * k);
      const x = n.getContext("2d");
      x.fillStyle = "#fff";
      x.fillRect(0, 0, n.width, n.height);
      x.drawImage(c, 0, 0, n.width, n.height);
      c = n;
    }
  }
  return c.toDataURL("image/jpeg", 0.5);
}

// Lê um PDF e devolve as páginas uma a uma: { w, h, bg }
export async function* readPdf(file, onProgress) {
  const pdf = await lib();
  const base = new URL("../vendor/", import.meta.url).href;
  const task = pdf.getDocument({
    data: await file.arrayBuffer(),
    cMapUrl: base + "cmaps/",
    cMapPacked: true,
    standardFontDataUrl: base + "standard_fonts/",
    wasmUrl: base + "wasm/",
  });
  try {
    const doc = await task.promise;
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
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
      const landscape = v1.width > v1.height;
      const w = landscape ? 1414 : 1000;
      const h = Math.round((w * v1.height) / v1.width);
      const bg = toJpeg(canvas);
      canvas.width = canvas.height = 0;
      page.cleanup();
      if (onProgress) onProgress(i, doc.numPages);
      yield { w, h, bg };
    }
  } finally {
    try { await task.destroy(); } catch {}
  }
}

// Prepara uma foto para entrar na página: { src, w, h } (em pixels).
export async function readImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error("Não foi possível abrir essa imagem."));
      im.src = url;
    });
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { src: toJpeg(canvas), w: canvas.width, h: canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Carrega as imagens de uma página antes de desenhá-la de uma vez.
export async function pageAssets(page) {
  const bgImg = page.bg ? await loadImage(page.bg).promise : null;
  const imgs = new Map();
  for (const it of page.items) {
    if (it.k === "i" && it.src) imgs.set(it.id, await loadImage(it.src).promise);
  }
  return { bgImg, getImg: (it) => imgs.get(it.id) || null };
}

// ---------- exportar em PDF ----------
// Cada página vira uma imagem dentro de um PDF montado aqui mesmo.

const PT = 595.28 / 1000; // pontos de PDF por unidade de página (A4 = 1000 de largura)

export async function exportPdf(pages, opts = {}) {
  // pages: função assíncrona geradora que entrega as páginas em ordem
  const enc = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let size = 0;
  const push = (data) => {
    const b = typeof data === "string" ? enc.encode(data) : data;
    chunks.push(b);
    size += b.length;
  };
  const obj = (n, body) => { offsets[n] = size; push(`${n} 0 obj\n`); body(); push("\nendobj\n"); };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const kids = [];
  let n = 2; // 1 = catálogo, 2 = lista de páginas
  let count = 0;

  for await (const page of pages()) {
    const scale = Math.min(2, (opts.maxSide || 2400) / Math.max(page.w, page.h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(page.w * scale);
    canvas.height = Math.round(page.h * scale);
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    const assets = await pageAssets(page);
    drawPageFlat(ctx, page, { ...assets, paper: opts.withPaper ? opts.paper : null, px: 1 / scale });
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", opts.quality || 0.9));
    const jpeg = new Uint8Array(await blob.arrayBuffer());
    const W = (page.w * PT).toFixed(2), H = (page.h * PT).toFixed(2);
    const img = ++n, content = ++n, pg = ++n;
    obj(img, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
      push(jpeg);
      push("\nendstream");
    });
    const stream = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    obj(content, () => push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`));
    obj(pg, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${img} 0 R >> >> /Contents ${content} 0 R >>`));
    kids.push(pg);
    canvas.width = canvas.height = 0;
    count++;
    if (opts.onProgress) opts.onProgress(count);
  }

  obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => push(`<< /Type /Pages /Count ${kids.length} /Kids [${kids.map((k) => k + " 0 R").join(" ")}] >>`));
  const xref = size;
  let table = `xref\n0 ${n + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= n; i++) table += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  push(table);
  push(`trailer\n<< /Size ${n + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks, { type: "application/pdf" });
}

export function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
