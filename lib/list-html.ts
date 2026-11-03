import 'server-only';
import { altImagesToShow, blankAlternatives, difficultyOf, type QImg } from '@/lib/question-types';
import { headersOf, type ListTemplate } from '@/lib/question-lists';
import type { Question } from '@/lib/questions';
import { pdfFontsCss } from '@/lib/pdf-fonts';
import { rich, richTex } from '@/lib/rich';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export type ListQuestion = Question & { exame?: string; paper_ano?: number | null };

/** Página A4 com margem estreita (1,27 cm). */
export const PAGE = { widthMm: 210, heightMm: 297, marginMm: 12.7 };
/** Altura (mm) de uma imagem que ocupa a largura útil da folha. */
export const imgHeightMm = (img: { w: number; h: number } | null) => (img ? ((PAGE.widthMm - 2 * PAGE.marginMm) * img.h) / img.w : 0);
/** Cabeçalho carimbado no alto da página (a partir de 8 mm da borda, com 3 mm de folga até o texto). */
export const HEADER_TOP_MM = 8;
export const headerSpaceMm = (img: { w: number; h: number } | null) => (img ? HEADER_TOP_MM + imgHeightMm(img) + 3 : PAGE.marginMm);
export const footerHeightMm = (t: ListTemplate | null) =>
  t?.footer_url && t.footer_w && t.footer_h ? ((PAGE.widthMm - 2 * PAGE.marginMm) * t.footer_h) / t.footer_w : 0;

function img(i: QImg, cls = '') {
  if (!i.url) return '';
  const w = i.largura ? ` style="width:min(100%, ${Math.round(i.largura * 0.75)}px)"` : '';
  return `<img class="${cls}" src="${esc(i.url)}" alt="${esc(i.alt ?? '')}"${w}>`;
}

/** Estrelas da dificuldade (parâmetro b da TRI): 1 fácil, 2 média, 3 difícil. */
export function stars(q: ListQuestion) {
  const d = difficultyOf(q.param_b);
  return d === 'facil' ? 1 : d === 'media' ? 2 : d === 'dificil' ? 3 : 0;
}

/** Linha pequena de cada questão: banca, ano e habilidade (as estrelas vão à parte). */
export function metaParts(q: ListQuestion) {
  const exame = q.exame || '';
  const banca = q.banca && q.banca !== exame ? q.banca : '';
  return [banca, [exame, q.ano ?? q.paper_ano].filter(Boolean).join(' '), q.habilidade].filter(Boolean);
}

/** Disciplinas da lista e os assuntos de cada uma (na ordem em que aparecem). */
export function subjectsOf(qs: ListQuestion[]) {
  const map = new Map<string, string[]>();
  for (const q of qs) {
    if (!q.disciplina) continue;
    const l = map.get(q.disciplina) ?? [];
    if (q.assunto_geral && !l.includes(q.assunto_geral)) l.push(q.assunto_geral);
    map.set(q.disciplina, l);
  }
  return [...map.entries()];
}

// estrela desenhada (não depende de fonte com o símbolo ★)
const STAR =
  '<svg viewBox="0 0 24 24" width="7.5" height="7.5"><path fill="currentColor" d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7.1L12 17.6 5.7 21.3l1.7-7.1L2 9.5l7.1-.6z"/></svg>';

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
  const ia = altImagesToShow(q);
  for (const i of ia) parts.push(`<div class="fig">${img(i)}</div>`);
  const alts = q.alternativas
    .map(
      (a) =>
        `<li><b class="l">${esc(a.letra)}</b><div class="at">${a.texto ? rich(a.texto) : ''}${a.imagem ? `<div class="fig left alt">${img(a.imagem)}</div>` : ''}</div></li>`,
    )
    .join('');
  // letras desenhadas na imagem (sem recorte): não repete "A) B) C)…" vazias embaixo
  const list = ia.length && blankAlternatives(q) ? '' : `<ol class="alts">${alts}</ol>`;
  const st = stars(q);
  const meta = `${metaParts(q).map(esc).join(' · ')}${st ? `<span class="stars" title="dificuldade">${STAR.repeat(st)}</span>` : ''}`;
  return `<section class="q"><h3>QUESTÃO ${String(n).padStart(2, '0')}${meta ? ` <span class="meta">${meta}</span>` : ''}</h3>${parts.join('')}${list}</section>`;
}

/** HTML da lista para virar PDF: coluna dupla, margem estreita, Arial 10, fórmulas e imagens no lugar. */
export function listHtml(title: string, qs: ListQuestion[], t: ListTemplate | null, opts: { answers?: boolean; resolutions?: boolean } = {}) {
  const footer = footerHeightMm(t);
  // cabeçalhos: 1ª página e demais (carimbados depois no PDF); "todas" = o mesmo nas duas
  const { first, rest } = headersOf(t);
  const stampFirst = Boolean(t?.header_all && first);
  const topFirst = stampFirst ? headerSpaceMm(first) : PAGE.marginMm;
  const topRest = headerSpaceMm(rest);
  // logo abaixo do cabeçalho: disciplinas e, ao lado de cada uma, os assuntos
  const subj = subjectsOf(qs);
  const subjects = subj.length
    ? `<section class="subjects">${subj.map(([d, a]) => `<p><b>${esc(d)}:</b> ${a.map(esc).join(', ')}</p>`).join('')}</section>`
    : '';
  const key = opts.answers
    ? `<section class="key"><h2>Gabarito</h2><div class="grid">${qs
        .map((q, i) => `<span><b>${i + 1}.</b> ${q.status === 'anulada' ? 'Anulada' : esc(q.gabarito || '–')}</span>`)
        .join('')}</div></section>${
        opts.resolutions
          ? `<section class="res"><h2>Resolução</h2>${qs
              .map(
                (q, i) =>
                  `<div class="r"><h3>QUESTÃO ${String(i + 1).padStart(2, '0')} · ${q.status === 'anulada' ? 'Anulada' : `Gabarito: ${esc(q.gabarito || '–')}`}</h3>${q.resolucao ? `<div class="t">${rich(q.resolucao)}</div>` : '<div class="t">Sem resolução.</div>'}</div>`,
              )
              .join('')}</section>`
          : ''
      }`
    : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>${pdfFontsCss()}</style>
<style>
@page { size: A4; margin: ${topRest.toFixed(1)}mm ${PAGE.marginMm}mm ${(PAGE.marginMm + footer).toFixed(1)}mm ${PAGE.marginMm}mm; }
@page :first { margin-top: ${topFirst.toFixed(1)}mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
body { font-family: Arimo, Arial, 'Liberation Sans', KaTeX_Main, KaTeX_AMS, Helvetica, sans-serif; font-size: 10pt; line-height: 1.35; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.header { width: 100%; display: block; margin: 0 0 4mm; }
h1.title { font-size: 12pt; margin: 0 0 3mm; text-align: center; }
.cols { column-count: 2; column-gap: 7mm; column-rule: 0.5pt solid #888; column-fill: auto; }
.q { margin: 0 0 5mm; }
.q h3 { font-size: 10pt; margin: 0 0 1.5mm; break-after: avoid; }
.q h3 span { font-weight: normal; }
.q h3 .meta { font-size: 7pt; color: #444; white-space: nowrap; margin-left: 1.5mm; }
.q h3 .stars { display: inline-flex; gap: 0.3mm; margin-left: 1.2mm; vertical-align: -0.3mm; color: #111; }
.subjects { margin: 0 0 4mm; padding: 2mm 3mm; border: 0.5pt solid #999; border-radius: 1.5mm; font-size: 9pt; line-height: 1.45; }
.subjects p { margin: 0; }
.t { margin: 0 0 1.5mm; text-align: justify; }
.t p { margin: 0 0 1.5mm; }
.t.titulo { font-weight: bold; text-align: left; }
.t.fonte { font-size: 7.5pt; text-align: right; color: #333; }
.eq { text-align: center; margin: 1.5mm 0; break-inside: avoid; }
.fig { text-align: center; margin: 1.5mm 0; break-inside: avoid; }
.fig.left { text-align: left; margin: 0.5mm 0 0; }
/* imagem da alternativa: visível, sem ocupar a coluna inteira */
.fig.alt img { width: auto !important; max-width: 60%; max-height: 30mm; }
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
.res { margin-top: 6mm; column-count: 2; column-gap: 7mm; column-rule: 0.5pt solid #888; }
.res h2 { column-span: all; font-size: 11pt; margin: 0 0 3mm; }
.res .r { margin: 0 0 4mm; }
.res .r h3 { font-size: 10pt; margin: 0 0 1mm; break-after: avoid; }
</style></head><body>
${first && !stampFirst ? `<img class="header" src="${esc(first.url)}" alt="">` : first ? '' : `<h1 class="title">${esc(title)}</h1>`}
${subjects}
<main class="cols">${qs.map((q, i) => questionHtml(q, i + 1)).join('\n')}</main>
${key}
</body></html>`;
}
