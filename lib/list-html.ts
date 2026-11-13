import 'server-only';
import { altImagesToShow, blankAlternatives, difficultyOf, vestYear, type QImg } from '@/lib/question-types';
import { headersOf, type ListTemplate } from '@/lib/question-lists';
import type { Question } from '@/lib/questions';
import { pdfFontsCss } from '@/lib/pdf-fonts';
import { bigHeader, SMALL_HEADER_MM, VERTICE_CSS } from '@/lib/vertice-brand';
import { rich, richTex } from '@/lib/rich';
import { hasResolution, resolutionHtml } from '@/lib/resolution';

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
  const vy = vestYear(q);
  // banca só quando diz algo a mais (INEP no Enem)
  const banca = q.banca && !vy.toUpperCase().startsWith(q.banca.toUpperCase()) ? q.banca : '';
  return [banca, vy, q.habilidade].filter(Boolean);
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

/** "Enem 2023", "Cesupa 2022": vestibular e ano da questão */
export function source(q: ListQuestion) {
  return vestYear(q);
}

export function questionHtml(q: ListQuestion, n: number, hideMeta = false) {
  const parts: string[] = [];
  for (const b of q.blocos) {
    if (b.tipo === 'texto') parts.push(`<div class="t ${b.estilo ?? 'corpo'}">${rich(b.conteudo)}</div>`);
    else if (b.tipo === 'equacao') parts.push(`<div class="eq">${richTex(b.latex)}</div>`);
    else if (b.tipo === 'imagem' && !b.dividida) parts.push(`<div class="fig${b.parte ? ' part' : ''}">${img(b)}</div>`);
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
  // tamanho visível do texto: fórmulas contam pelos caracteres que aparecem (sem os comandos do LaTeX)
  const plainLen = (t: string) =>
    t
      .replace(/\$([^$]*)\$/g, (_, m: string) => m.replace(/\\[a-zA-Z]+/g, '').replace(/[{}_^\\,;!]/g, ''))
      .replace(/[*_]/g, '')
      .trim().length;
  // alternativas curtas lado a lado: 5, 3 ou 2 por linha conforme o tamanho
  const longest = Math.max(0, ...q.alternativas.map((a) => (a.imagem ? 99 : plainLen(a.texto ?? ''))));
  const cols = !q.alternativas.length ? 0 : longest <= 7 ? 5 : longest <= 16 ? 3 : longest <= 28 ? 2 : 0;
  const list = ia.length && blankAlternatives(q) ? '' : `<ol class="alts${cols ? ` row c${cols}` : ''}">${alts}</ol>`;
  const st = stars(q);
  // PDF do aluno: só o vestibular e o ano (sem habilidade nem dificuldade)
  const meta = hideMeta ? esc(source(q)) : `${metaParts(q).map(esc).join(' · ')}${st ? `<span class="stars" title="dificuldade">${STAR.repeat(st)}</span>` : ''}`;
  return `<section class="q"><h3><span class="lab">QUESTÃO ${String(n).padStart(2, '0')}</span>${meta ? ` <span class="meta">${meta}</span>` : ''}</h3>${parts.join('')}${list}</section>`;
}

/** HTML da lista para virar PDF: coluna dupla, margem estreita, Arial 10, fórmulas e imagens no lugar. */
export interface StudentMark {
  name: string;
  cpf: string;
  email: string;
}

const cpfMask = (c: string) => {
  const d = c.replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : c;
};

export function listHtml(
  title: string,
  qs: ListQuestion[],
  t: ListTemplate | null,
  opts: {
    answers?: boolean;
    resolutions?: boolean;
    /** só o gabarito e as resoluções (sem as questões) */
    onlyResolutions?: boolean;
    /** PDF do aluno: sem banca/ano/dificuldade nas questões */
    hideMeta?: boolean;
    /** nome completo, CPF e e-mail do aluno + aviso de direitos autorais na 1ª página */
    student?: StudentMark | null;
    /** padrão Vértice: faixa grande na 1ª página (disciplinas, nome, nº de questões), faixa menor nas seguintes */
    vertice?: boolean;
  } = {},
) {
  const footer = footerHeightMm(t);
  // cabeçalhos: 1ª página e demais (carimbados depois no PDF); "todas" = o mesmo nas duas
  const { first, rest } = headersOf(opts.vertice ? null : t);
  const stampFirst = Boolean(!opts.vertice && t?.header_all && first);
  const topFirst = opts.vertice ? 10 : stampFirst ? headerSpaceMm(first) : PAGE.marginMm;
  const topRest = opts.vertice ? HEADER_TOP_MM + SMALL_HEADER_MM + 3 : headerSpaceMm(rest);
  const bottom = opts.vertice ? 16 : PAGE.marginMm + footer;
  // logo abaixo do cabeçalho: disciplinas e, ao lado de cada uma, os assuntos
  const subj = subjectsOf(qs);
  const subjects = subj.length
    ? `<section class="subjects">${subj.map(([d, a]) => `<p><b>${esc(d)}:</b> ${a.map(esc).join(', ')}</p>`).join('')}</section>`
    : '';
  const owner = opts.student
    ? `<section class="owner"><p><b>Aluno(a):</b> ${esc(opts.student.name)}${opts.student.cpf ? ` · <b>CPF:</b> ${esc(cpfMask(opts.student.cpf))}` : ''} · <b>E-mail:</b> ${esc(opts.student.email)}</p>
<p class="copy">© Curso Vértice. Material de uso pessoal e intransferível do(a) aluno(a) identificado(a) acima. É proibida a reprodução, cópia, distribuição ou compartilhamento, total ou parcial, por qualquer meio, sem autorização (Lei nº 9.610/1998 – Lei de Direitos Autorais).</p></section>`
    : '';
  const key =
    opts.answers || opts.onlyResolutions
      ? `<section class="key"><h2>Gabarito</h2><div class="grid">${qs
          .map((q, i) => `<span><b>${i + 1}.</b> ${q.status === 'anulada' ? 'Anulada' : esc(q.gabarito || '–')}</span>`)
          .join('')}</div></section>${
          // só as questões que têm resolução (o gabarito de todas já está acima)
          (opts.resolutions || opts.onlyResolutions) && qs.some(hasResolution)
            ? `<section class="res"><h2>Resolução</h2>${qs
                .map((q, i) =>
                  hasResolution(q)
                    ? `<div class="r"><h3>QUESTÃO ${String(i + 1).padStart(2, '0')} · ${q.status === 'anulada' ? 'Anulada' : `Gabarito: ${esc(q.gabarito || '–')}`}</h3><div class="t">${resolutionHtml(q, (im) => img(im))}</div></div>`
                    : '',
                )
                .join('')}</section>`
            : ''
        }`
      : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>${pdfFontsCss()}</style>
<style>
@page { size: A4; margin: ${topRest.toFixed(1)}mm ${PAGE.marginMm}mm ${bottom.toFixed(1)}mm ${PAGE.marginMm}mm; }
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
.q h3 .lab { font-weight: bold; }
.q h3 .meta { font-size: 7pt; color: #444; white-space: nowrap; margin-left: 1.5mm; }
.q h3 .stars { display: inline-flex; gap: 0.3mm; margin-left: 1.2mm; vertical-align: -0.3mm; color: #111; }
.subjects { margin: 0 0 4mm; padding: 2mm 3mm; border: 0.5pt solid #999; border-radius: 1.5mm; font-size: 9pt; line-height: 1.45; }
.subjects p { margin: 0; }
.owner { margin: -2mm 0 4mm; font-size: 8.5pt; }
.owner p { margin: 0 0 1mm; }
.owner .copy { font-size: 7pt; color: #444; text-align: justify; }
.only-res .key { break-before: auto; }
.t { margin: 0 0 1.5mm; text-align: justify; }
.t p { margin: 0 0 1.5mm; }
.t.titulo { font-weight: bold; text-align: left; }
.t.fonte { font-size: 7.5pt; text-align: right; color: #333; }
.eq { text-align: center; margin: 1.5mm 0; break-inside: avoid; }
.fig { text-align: center; margin: 1.5mm 0; break-inside: avoid; }
.fig.left { text-align: left; margin: 0.5mm 0 0; }
/* partes de uma imagem alta: coladas umas nas outras (podem ir para a outra coluna) */
.fig.part { margin: 0; }
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
${opts.vertice ? VERTICE_CSS : ''}
</style></head><body class="${[opts.onlyResolutions ? 'only-res' : '', opts.vertice ? 'vertice' : ''].join(' ')}">
${
  opts.vertice
    ? bigHeader(
        title,
        subj.map(([d]) => d),
        qs.length,
        subj.flatMap(([, a]) => a),
      )
    : first && !stampFirst
      ? `<img class="header" src="${esc(first.url)}" alt="">`
      : first
        ? ''
        : `<h1 class="title">${esc(title)}</h1>`
}
${opts.vertice ? '' : subjects}
${owner}
${opts.onlyResolutions ? '' : `<main class="cols">${qs.map((q, i) => questionHtml(q, i + 1, opts.hideMeta)).join('\n')}</main>`}
${key}
</body></html>`;
}
