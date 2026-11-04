/**
 * Padrão Vértice dos PDFs (listas, apostilas do aluno): faixa grande na 1ª página, faixa menor
 * nas seguintes e rodapé com os dados do curso. Os textos ficam aqui para mudar num lugar só.
 */
export const BRAND = {
  course: 'Curso Vértice',
  teacher: 'Prof. Luiz Paulo',
  handle: '@cursovertice',
  phone: '(91) 980461223',
  navy: '#17284f',
  orange: '#e9a23b',
};

export const LOGO_SVG = `<svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><polygon points="6,10 29,10 59,72 49,92" fill="currentColor"/><polygon points="33,11 59,11 46,36" stroke="currentColor" stroke-width="3.2" fill="none"/><polygon points="49,37 62,12 75,37" stroke="currentColor" stroke-width="3.2" fill="none"/><polygon points="65,11 92,11 78.5,36" stroke="currentColor" stroke-width="3.2" fill="none"/><polygon points="49,41 76,41 62.5,67" fill="currentColor"/></svg>`;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Faixa grande da 1ª página: disciplinas em cima, nome da lista ao lado da logo, nº de questões embaixo. */
export function bigHeader(title: string, disciplinas: string[], count: number, assuntos: string[]) {
  const sub = `${count} ${count === 1 ? 'questão' : 'questões'}${assuntos.length ? ` · ${assuntos.join(', ')}` : ''}`;
  return `<header class="vb">
<div class="vb-logo">${LOGO_SVG}</div>
<div class="vb-main">
  ${disciplinas.length ? `<p class="vb-top">${disciplinas.map((d) => esc(d.toUpperCase())).join(' <span>•</span> ')}</p>` : ''}
  <h1>${esc(title)}</h1>
  <p class="vb-sub">${esc(sub)}</p>
</div>
<div class="vb-right"><b>${BRAND.teacher}</b><br>${BRAND.handle}<br>${BRAND.phone}</div>
</header>`;
}

/** Faixa menor das páginas seguintes (vira imagem e é carimbada no alto de cada página a partir da 2ª). */
export function smallHeaderHtml(title: string, fontsCss: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontsCss}
*{box-sizing:border-box}html,body{margin:0;background:#fff}
.bar{width:698px;height:53px;background:${BRAND.navy};color:#fff;display:flex;align-items:center;gap:12px;padding:0 16px;border-bottom:3px solid ${BRAND.orange};font-family:Arimo,Arial,sans-serif}
.bar svg{width:34px;height:34px;color:#fff;flex:none}
.l{flex:1;min-width:0}.l b{display:block;font-size:15px;letter-spacing:.3px}.l span{display:block;font-size:9.5px;color:#c9d3ea;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.r{text-align:right;font-size:9.5px;line-height:1.35}.r b{display:block;font-size:10.5px;letter-spacing:.4px}
</style></head><body><div class="bar">${LOGO_SVG}<div class="l"><b>${BRAND.course.toUpperCase()}</b><span>${esc(title)}</span></div><div class="r"><b>APOSTILA VÉRTICE</b>${BRAND.teacher} • ${BRAND.handle}</div></div></body></html>`;
}

/** Altura da faixa menor no papel (mm): 53 px de 698 px em 184,6 mm. */
export const SMALL_HEADER_MM = (53 * 184.6) / 698;

export const footerText = `${BRAND.course} • ${BRAND.teacher} • ${BRAND.handle} • ${BRAND.phone}`;

/** CSS do padrão Vértice (faixa grande, rótulo das questões, alternativas curtas numa linha). */
export const VERTICE_CSS = `
.vb { display: flex; align-items: center; gap: 5mm; background: ${BRAND.navy}; color: #fff; border-radius: 3mm; border-left: 2.2mm solid ${BRAND.orange}; padding: 5mm 6mm; margin: 0 0 4mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.vb-logo svg { width: 19mm; height: 19mm; color: #fff; display: block; }
.vb-main { flex: 1; min-width: 0; }
.vb-top { margin: 0 0 1mm; color: ${BRAND.orange}; font-size: 7.5pt; font-weight: 700; letter-spacing: 0.4pt; }
.vb-top span { color: ${BRAND.orange}; opacity: 0.8; padding: 0 0.6mm; }
.vb h1 { margin: 0; font-size: 21pt; line-height: 1.1; font-weight: 700; letter-spacing: 0.2pt; }
.vb-sub { margin: 1.5mm 0 0; font-size: 7.5pt; color: #c9d3ea; }
.vb-right { text-align: right; font-size: 7.5pt; line-height: 1.45; color: #dbe3f4; white-space: nowrap; }
.vb-right b { color: #fff; font-size: 8pt; }
body.vertice .q h3 { display: flex; align-items: center; gap: 2mm; font-size: 7pt; letter-spacing: 0.6pt; margin: 0 0 1.8mm; }
body.vertice .q h3 .lab { background: ${BRAND.navy}; color: #fff; border-radius: 1mm; padding: 0.5mm 1.8mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body.vertice .q h3::after { content: ''; flex: 1; border-bottom: 0.4pt solid #c9ced8; }
body.vertice ol.alts .l { border: none; width: auto; height: auto; font-size: 9.5pt; color: ${BRAND.navy}; font-weight: 700; margin: 0; }
body.vertice ol.alts.row { display: grid; gap: 1mm 3mm; }
body.vertice ol.alts.c5 { grid-template-columns: repeat(5, 1fr); }
body.vertice ol.alts.c3 { grid-template-columns: repeat(3, 1fr); }
body.vertice ol.alts.c2 { grid-template-columns: repeat(2, 1fr); }
body.vertice ol.alts.row li { margin: 0; gap: 1mm; }
`;
