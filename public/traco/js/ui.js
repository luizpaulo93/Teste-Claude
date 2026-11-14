// Peças de interface compartilhadas: ícones, janelas, avisos.

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function h(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

const P = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  up: '<path d="M5 15l7-7 7 7"/>',
  down: '<path d="M5 9l7 7 7-7"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 000 12h3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pages: '<rect x="4" y="3" width="12" height="15" rx="2"/><path d="M8 21h10a2 2 0 002-2V8"/>',
  paper: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 9h8M8 13h8M8 17h8"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  live: '<circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M7.5 7.5a6.4 6.4 0 000 9M16.5 7.5a6.4 6.4 0 010 9M4.6 4.6a10.5 10.5 0 000 14.8M19.4 4.6a10.5 10.5 0 010 14.8"/>',
  pen: '<path d="M4 20l1.2-4.6L16.5 4.1a2 2 0 012.8 0l.6.6a2 2 0 010 2.8L8.6 18.8z"/><path d="M14.5 6.1l3.4 3.4"/>',
  hl: '<path d="M9 14.5l7.6-9a1.7 1.7 0 012.5-.1l.1.1a1.7 1.7 0 01-.1 2.5l-9 7.6z"/><path d="M9 14.5l-2.2 2.2 1.5 1.5 2.3-2.1M3 21h7"/>',
  eraser: '<path d="M8.5 19.5L3.8 14.8a1.6 1.6 0 010-2.3l8-8a1.6 1.6 0 012.3 0l5.6 5.6a1.6 1.6 0 010 2.3l-7.1 7.1z"/><path d="M8 9l6.5 6.5M8.5 19.5H20"/>',
  lasso: '<ellipse cx="12" cy="10" rx="8" ry="5.5" stroke-dasharray="3 2.6"/><path d="M8 14.8c-1.8 1.4-1.8 3.4.4 3.9 1.6.3 2.6-1 2.2-2.2-.5-1.4-2.6-.9-2.6.8 0 1.5 1 2.4 2.4 2.7"/>',
  shape: '<rect x="3.5" y="10" width="10" height="10" rx="1.5"/><circle cx="15.5" cy="8.5" r="5"/>',
  laser: '<circle cx="12" cy="12" r="2.4" fill="currentColor"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  finger: '<path d="M9 11V5.5a1.5 1.5 0 013 0V11"/><path d="M12 10.5V9a1.5 1.5 0 013 0v2M15 11v-.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-.6a6 6 0 01-4.7-2.3L4.4 15a1.5 1.5 0 012.3-1.9L9 15V11"/>',
  hand: '<path d="M9 11V5.5a1.5 1.5 0 013 0V11"/><path d="M12 10.5V9a1.5 1.5 0 013 0v2M15 11v-.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-.6a6 6 0 01-4.7-2.3L4.4 15a1.5 1.5 0 012.3-1.9L9 15V11"/>',
  trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l.8 12a1.5 1.5 0 001.5 1.4h5.4a1.5 1.5 0 001.5-1.4L17 7"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4"/>',
  pdf: '<path d="M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"/><path d="M14 3v5h5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  user: '<circle cx="12" cy="8.5" r="3.6"/><path d="M4.8 20a7.2 7.2 0 0114.4 0"/>',
  users: '<circle cx="9" cy="9" r="3.2"/><path d="M2.8 19.5a6.2 6.2 0 0112.4 0M16 6.2a3.2 3.2 0 010 5.8M17.5 14.6a6.2 6.2 0 013.7 4.9"/>',
  out: '<path d="M14 5H7a2 2 0 00-2 2v10a2 2 0 002 2h7M11 12h10M17.5 8.5L21 12l-3.5 3.5"/>',
  key: '<circle cx="8" cy="15" r="3.6"/><path d="M10.7 12.3L19 4M15.5 7.5l2.6 2.6"/>',
  full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  more: '<circle cx="5.5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="18.5" cy="12" r="1.4" fill="currentColor"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="12" rx="2"/><path d="M5.5 15.5V5.5a2 2 0 012-2h8"/>',
  line: '<path d="M5 19L19 5"/>',
  arrow: '<path d="M5 19L19 5M10 5h9v9"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="8.5" ry="6"/>',
  fit: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M9 12h6M12 9v6"/>',
};

export function icon(name, size = 22) {
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;
}

// Aviso rápido no rodapé. Devolve { update, close }.
export function toast(msg, opts = {}) {
  let host = document.querySelector(".toasts");
  if (!host) { host = h('<div class="toasts" role="status" aria-live="polite"></div>'); document.body.appendChild(host); }
  const el = h(`<div class="toast${opts.error ? " is-error" : ""}"></div>`);
  el.textContent = msg;
  host.appendChild(el);
  let timer;
  const close = () => { clearTimeout(timer); el.remove(); };
  if (!opts.sticky) timer = setTimeout(close, opts.ms || 3200);
  return { update: (m) => { el.textContent = m; }, close };
}

// Janela central. Fecha com Esc ou clique fora (a menos que `locked`).
export function modal(inner, opts = {}) {
  const wrap = h(`<div class="modal-wrap"><div class="modal ${opts.cls || ""}" role="dialog" aria-modal="true"></div></div>`);
  const box = wrap.firstElementChild;
  if (typeof inner === "string") box.innerHTML = inner;
  else box.appendChild(inner);
  const close = (val) => {
    document.removeEventListener("keydown", onKey);
    wrap.remove();
    if (opts.onClose) opts.onClose(val);
  };
  const onKey = (e) => { if (e.key === "Escape" && !opts.locked) close(); };
  wrap.addEventListener("pointerdown", (e) => { if (e.target === wrap && !opts.locked) close(); });
  document.addEventListener("keydown", onKey);
  box.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => close()));
  document.body.appendChild(wrap);
  const first = box.querySelector("[autofocus], input, button");
  if (first) first.focus(); // na hora, para não roubar o foco de quem já começou a digitar
  return { el: box, close };
}

export function confirmBox({ title, text, ok = "Confirmar", cancel = "Cancelar", danger }) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal(
      `<h2>${esc(title)}</h2><p class="muted">${esc(text)}</p>
       <div class="row end"><button class="btn" data-no>${esc(cancel)}</button>
       <button class="btn ${danger ? "is-danger" : "is-primary"}" data-yes>${esc(ok)}</button></div>`,
      { cls: "is-small", onClose: () => { if (!done) resolve(false); } }
    );
    m.el.querySelector("[data-no]").onclick = () => m.close();
    m.el.querySelector("[data-yes]").onclick = () => { done = true; m.close(); resolve(true); };
  });
}

// Caixinha presa a um botão (menus e ajustes).
export function popover(anchor, content, opts = {}) {
  document.querySelectorAll(".pop").forEach((p) => p._close && p._close());
  const el = h('<div class="pop"></div>');
  el.appendChild(content);
  document.body.appendChild(el);
  const r = anchor.getBoundingClientRect();
  const w = el.offsetWidth, hh = el.offsetHeight;
  let x = opts.align === "left" ? r.left : r.right - w;
  x = Math.max(8, Math.min(x, innerWidth - w - 8));
  let y = r.bottom + 8;
  if (y + hh > innerHeight - 8) y = Math.max(8, r.top - hh - 8);
  el.style.left = x + "px";
  el.style.top = y + "px";
  const close = () => {
    document.removeEventListener("pointerdown", out, true);
    document.removeEventListener("keydown", key);
    el.remove();
    anchor.classList.remove("is-open");
  };
  const out = (e) => { if (!el.contains(e.target) && !anchor.contains(e.target)) close(); };
  const key = (e) => { if (e.key === "Escape") close(); };
  setTimeout(() => {
    document.addEventListener("pointerdown", out, true);
    document.addEventListener("keydown", key);
  }, 0);
  el._close = close;
  anchor.classList.add("is-open");
  return { el, close };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function formatCode(code) {
  return String(code).replace(/(\d{3})(\d{3})/, "$1 $2");
}

// Liga/desliga a tela cheia. Devolve false se o navegador não permitir.
export function toggleFullscreen() {
  const d = document, el = d.documentElement;
  if (d.fullscreenElement || d.webkitFullscreenElement) {
    const exit = d.exitFullscreen || d.webkitExitFullscreen;
    try { const r = exit.call(d); if (r && r.catch) r.catch(() => {}); } catch {}
    return true;
  }
  const enter = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!enter) return false;
  try { const r = enter.call(el); if (r && r.catch) r.catch(() => {}); } catch { return false; }
  return true;
}

// iPad e iPhone (qualquer navegador neles) e site aberto pelo ícone da Tela de Início.
export const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const STANDALONE = navigator.standalone === true || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
if (IOS && STANDALONE) document.documentElement.classList.add("is-installed"); // já abre em tela cheia

// Botão de tela cheia. No iPad, o navegador sai da tela cheia sozinho quando
// se desliza para baixo (ao escrever, por exemplo) e o site não tem como
// impedir; por isso, lá o botão explica como abrir o app em tela cheia fixa.
export function fullscreenButton() {
  const d = document;
  if (d.fullscreenElement || d.webkitFullscreenElement) { toggleFullscreen(); return; }
  if (!IOS) { if (!toggleFullscreen()) toast(NO_FULLSCREEN, { ms: 8000 }); return; }
  const can = !!(d.documentElement.requestFullscreen || d.documentElement.webkitRequestFullscreen);
  const m = modal(
    `<h2>Tela cheia no ${/iPhone|iPod/.test(navigator.userAgent) ? "iPhone" : "iPad"}</h2>
     <p class="muted">Aqui o navegador sai da tela cheia sozinho quando a caneta ou o dedo desliza para baixo, e o site não consegue impedir.</p>
     <p class="muted">Para ficar em tela cheia o tempo todo, toque em <b>Compartilhar</b> e em <b>Adicionar à Tela de Início</b>, e abra o Traço pelo ícone. Lá não há barras do navegador e a tela não sai do lugar ao escrever.</p>
     <p class="muted">Os cadernos ficam guardados em cada lugar separadamente: antes de trocar, baixe em PDF os que estão aqui.</p>
     <div class="row end">${can ? '<button class="btn" data-native>Usar a tela cheia do navegador</button>' : ""}
     <button class="btn is-primary" data-close autofocus>Entendi</button></div>`,
    { cls: "is-small" }
  );
  const b = m.el.querySelector("[data-native]");
  if (b) b.onclick = () => { m.close(); toggleFullscreen(); };
}

export const NO_FULLSCREEN =
  "Este navegador não permite tela cheia. No iPad, abra o site no Safari e use Compartilhar → Adicionar à Tela de Início: ele abre sem as barras.";
