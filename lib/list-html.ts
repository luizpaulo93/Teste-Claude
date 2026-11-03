import 'server-only';
import type { QImg } from '@/lib/question-types';
import type { ListTemplate } from '@/lib/question-lists';
import type { Question } from '@/lib/questions';
import { rich, richTex } from '@/lib/rich';

const KATEX_CSS = 'https://cdn.jsdelivr.net/npm/katex@0.19.1/dist/katex.min.css';
// Arimo tem as mesmas medidas da Arial (o servidor não tem a Arial instalada)
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Arimo:ital,wght@0,400;0,700;1,400;1,700&display=block';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export type ListQuestion = Question & { exame?: string; paper_ano?: number | null };

/** Página A4 com margem estreita (1,27 cm). */
export const PAGE = { widthMm: 210, heightMm: 297, marginMm: 12.7 };
export const footerHeightMm = (t: ListTemplate | null) =>
  t?.footer_url && t.footer_w && t.footer_h ? ((PAGE.widthMm - 2 * PAGE.marginMm) * t.footer_h) / t.footer_w : 0;

function img(i: QImg, cls = '') {
  if (!i.url) return '';
  const w = i.largura ? ` style="width:min(100%, ${Math.round(i.largura * 0.75)}px)"` : '';
  return `<img class="${cls}" src="${esc(i.url)}" alt="${esc(i.alt ?? '')}"${w}>`;
}

export function source(q: ListQuestion) {
  return [q.exame || q.banca, q.ano ?? q.paper_ano].filter(Boolean).join(' ');
}

export function questionHtml(q: ListQuestion, n: number) {
  const parts: string[] = [];
  for (const b of q.blocos) {
    if (b.tipo === 'texto') parts.push(`<div class="t ${b.estilo ?? 'corpo'}">${rich(b.conteudo)}</div>`);
    else if (b.tipo === 'equacao') parts.push(`<div class="eq">${richTex(b.latex)}</div>`);
    else if (b.tipo === 'imagem') parts.push(`<div class="fig">${img(b)}</div>`);
    else if (b.tipo === 'tabela') {
      const head = b.cabecalho.length ? `<thead><tr>${b.cabecalho.map((c) => `<th>${rich(c, true)}</th>`).join('')}</tr></thead>` : '';
      const body = b.linhas.map((r) => `<tr>${r.map((c) => `<td>${rich(c, true)}</td>`).join('')}</tr>`).join('');
      parts.push(`<table>${b.legenda ? `<caption>${rich(b.legenda, true)}</caption>` : ''}${head}<tbody>${body}</tbody></table>`);
    }
  }
  const ia = Array.isArray(q.imagem_alternativas) ? q.imagem_alternativas : q.imagem_alternativas ? [q.imagem_alternativas] : [];
  for (const i of ia) parts.push(`<div class="fig">${img(i)}</div>`);
  const alts = q.alternativas
    .map(
      (a) =>
        `<li><b class="l">${esc(a.letra)}</b><div class="at">${a.texto ? rich(a.texto) : ''}${a.imagem ? `<div class="fig left">${img(a.imagem)}</div>` : ''}</div></li>`,
    )
    .join('');
  const src = source(q);
  return `<section class="q"><h3>QUESTÃO ${String(n).padStart(2, '0')}${src ? ` <span>(${esc(src)})</span>` : ''}</h3>${parts.join('')}<ol class="alts">${alts}</ol></section>`;
}

/** HTML da lista para virar PDF: coluna dupla, margem estreita, Arial 10, fórmulas e imagens no lugar. */
export function listHtml(title: string, qs: ListQuestion[], t: ListTemplate | null, opts: { answers?: boolean } = {}) {
  const footer = footerHeightMm(t);
  const key = opts.answers
    ? `<section class="key"><h2>Gabarito</h2><div class="grid">${qs
        .map((q, i) => `<span><b>${i + 1}.</b> ${q.status === 'anulada' ? 'Anulada' : esc(q.gabarito || '–')}</span>`)
        .join('')}</div></section>`
    : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="stylesheet" href="${KATEX_CSS}"><link rel="stylesheet" href="${FONT_CSS}">
<style>
@page { size: A4; margin: ${PAGE.marginMm}mm ${PAGE.marginMm}mm ${(PAGE.marginMm + footer).toFixed(1)}mm ${PAGE.marginMm}mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
body { font-family: Arial, Arimo, 'Liberation Sans', Helvetica, sans-serif; font-size: 10pt; line-height: 1.35; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.header { width: 100%; display: block; margin: 0 0 4mm; }
h1.title { font-size: 12pt; margin: 0 0 3mm; text-align: center; }
.cols { column-count: 2; column-gap: 7mm; column-rule: 0.5pt solid #888; column-fill: auto; }
.q { margin: 0 0 5mm; }
.q h3 { font-size: 10pt; margin: 0 0 1.5mm; break-after: avoid; }
.q h3 span { font-weight: normal; }
.t { margin: 0 0 1.5mm; text-align: justify; }
.t p { margin: 0 0 1.5mm; }
.t.titulo { font-weight: bold; text-align: left; }
.t.fonte { font-size: 7.5pt; text-align: right; color: #333; }
.eq { text-align: center; margin: 1.5mm 0; break-inside: avoid; }
.fig { text-align: center; margin: 1.5mm 0; break-inside: avoid; }
.fig.left { text-align: left; margin: 0.5mm 0 0; }
.fig img { max-width: 100%; height: auto; }
table { border-collapse: collapse; margin: 1.5mm auto; font-size: 9pt; break-inside: avoid; max-width: 100%; }
th, td { border: 0.5pt solid #000; padding: 0.8mm 1.6mm; text-align: center; }
th { font-weight: bold; }
caption { caption-side: bottom; font-size: 8pt; padding-top: 1mm; }
ol.alts { list-style: none; margin: 1.5mm 0 0; padding: 0; }
ol.alts li { display: flex; gap: 2mm; margin: 0 0 1mm; break-inside: avoid; }
ol.alts .l { flex: none; width: 4.5mm; height: 4.5mm; border: 0.6pt solid #000; border-radius: 50%; font-size: 8pt; display: inline-flex; align-items: center; justify-content: center; margin-top: 0.3mm; }
ol.alts .at { flex: 1; min-width: 0; }
ol.alts .at p { margin: 0; }
.katex { font-size: 1.05em; }
.katex-display { margin: 1mm 0; }
.key { break-before: page; column-span: all; }
.key h2 { font-size: 11pt; margin: 0 0 3mm; }
.key .grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 1.5mm 3mm; }
</style></head><body>
${t?.header_url ? `<img class="header" src="${esc(t.header_url)}" alt="">` : `<h1 class="title">${esc(title)}</h1>`}
<main class="cols">${qs.map((q, i) => questionHtml(q, i + 1)).join('\n')}</main>
${key}
</body></html>`;
}
