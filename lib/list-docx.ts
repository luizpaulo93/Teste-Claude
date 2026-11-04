import 'server-only';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  ImportedXmlComponent,
  LineRuleType,
  Packer,
  PageBreak,
  SectionType,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
} from 'docx';
import katex from 'katex';
import { mml2omml } from 'mathml2omml';
import sharp from 'sharp';
import { metaParts, stars, subjectsOf, type ListQuestion } from '@/lib/list-html';
import { headersOf, type ListTemplate } from '@/lib/question-lists';
import { altImagesToShow, blankAlternatives, type QImg } from '@/lib/question-types';

/**
 * Lista em Word (.docx): coluna dupla, margem estreita (1,27 cm), Arial 10.
 * Fórmulas viram equações do próprio Word (editáveis); imagens no mesmo lugar do enunciado.
 */
const MARGIN = 720; // 1,27 cm em twips
const GAP = 397; // 7 mm entre as colunas
const TEXT_PX = 698; // largura útil da página (18,46 cm) em px de 96 dpi
const COL_PX = Math.floor((TEXT_PX - 26) / 2);
const SIZE = 20; // 10 pt (meio-pontos)

// ---------------------------------------------------------------- texto (Markdown + LaTeX) → trechos do Word
type Seg = { math: string } | { text: string; b: boolean; i: boolean; u: boolean } | { br: true };
const DOLLAR = '';

function omml(tex: string, display: boolean): ParagraphChild | null {
  try {
    const html = katex.renderToString(tex, { output: 'mathml', throwOnError: false, displayMode: display, strict: 'ignore' });
    const m = html.match(/<math[\s\S]*<\/math>/)?.[0];
    if (!m) return null;
    let xml = mml2omml(m.replace(/<annotation[\s\S]*?<\/annotation>/g, ''));
    if (display) xml = `<m:oMathPara xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">${xml}</m:oMathPara>`;
    // fromXmlString embrulha num nó sem nome: o primeiro filho é a equação
    return (ImportedXmlComponent.fromXmlString(xml) as unknown as { root: ParagraphChild[] }).root[0] ?? null;
  } catch {
    return null;
  }
}

function inline(text: string, out: Seg[]) {
  let s = text;
  for (let k = 0; k < 4; k++) {
    const before = s;
    s = s
      .replace(/\\textbf\{([^{}]*)\}/g, '\u0001$1\u0002')
      .replace(/\\(?:textit|emph)\{([^{}]*)\}/g, '\u0003$1\u0004')
      .replace(/\\underline\{([^{}]*)\}/g, '\u0005$1\u0006');
    if (s === before) break;
  }
  s = s.replace(/\*\*([^*]+)\*\*/g, '\u0001$1\u0002').replace(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/g, '\u0003$1\u0004');
  let b = false;
  let i = false;
  let u = false;
  let buf = '';
  const flush = () => {
    if (buf) out.push({ text: buf.replace(new RegExp(DOLLAR, 'g'), '$'), b, i, u });
    buf = '';
  };
  for (const ch of s) {
    if (ch === '\u0001' || ch === '\u0002') (flush(), (b = ch === '\u0001'));
    else if (ch === '\u0003' || ch === '\u0004') (flush(), (i = ch === '\u0003'));
    else if (ch === '\u0005' || ch === '\u0006') (flush(), (u = ch === '\u0005'));
    else if (ch === '\n') (flush(), out.push({ br: true }));
    else buf += ch;
  }
  flush();
}

/** Parágrafos (separados por linha em branco), cada um com texto formatado e fórmulas. */
function paragraphs(src: string): Seg[][] {
  let s = String(src ?? '');
  s = s.replace(/\\\$/g, DOLLAR).replace(/(?<![$\w\\])R\$(?![A-Za-z\\{_^])/g, `R${DOLLAR}`);
  const even = (s.match(/\$/g)?.length ?? 0) % 2 === 0;
  return s
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((p) => {
      const out: Seg[] = [];
      if (!even) {
        inline(p.replace(/\$/g, DOLLAR), out);
        return out;
      }
      const re = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g;
      let last = 0;
      for (const m of p.matchAll(re)) {
        inline(p.slice(last, m.index), out);
        out.push({ math: m[1] ?? m[2] });
        last = m.index! + m[0].length;
      }
      inline(p.slice(last), out);
      return out;
    });
}

function runs(segs: Seg[], extra: { size?: number; bold?: boolean } = {}): ParagraphChild[] {
  const out: ParagraphChild[] = [];
  for (const g of segs) {
    if ('br' in g) out.push(new TextRun({ break: 1 }));
    else if ('math' in g) {
      const m = omml(g.math, false);
      out.push(m ?? new TextRun({ text: g.math, italics: true, size: extra.size }));
    } else out.push(new TextRun({ text: g.text, bold: g.b || extra.bold, italics: g.i, underline: g.u ? {} : undefined, size: extra.size }));
  }
  return out;
}

const textParas = (src: string, opts: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; size?: number; bold?: boolean; indent?: number } = {}) =>
  paragraphs(src).map(
    (segs) =>
      new Paragraph({
        alignment: opts.align ?? AlignmentType.JUSTIFIED,
        spacing: { after: 60 },
        indent: opts.indent ? { left: opts.indent } : undefined,
        children: runs(segs, opts),
      }),
  );

// ---------------------------------------------------------------- imagens (o Word não abre .webp: vira PNG)
const imgCache = new Map<string, Promise<{ data: Buffer; w: number; h: number } | null>>();
function loadImg(url: string) {
  if (!imgCache.has(url))
    imgCache.set(
      url,
      (async () => {
        try {
          const r = await fetch(url);
          if (!r.ok) return null;
          const { data, info } = await sharp(Buffer.from(await r.arrayBuffer()))
            .flatten({ background: '#ffffff' })
            .png()
            .toBuffer({ resolveWithObject: true });
          return { data, w: info.width, h: info.height };
        } catch {
          return null;
        }
      })(),
    );
  return imgCache.get(url)!;
}

async function imageRun(i: QImg | { url: string; largura?: number | null }, maxPx: number, maxH = Infinity) {
  if (!i.url) return null;
  const got = await loadImg(i.url);
  if (!got) return null;
  let want = Math.min(maxPx, i.largura ? i.largura * 0.75 : got.w * 0.75);
  if ((want * got.h) / got.w > maxH) want = (maxH * got.w) / got.h;
  return new ImageRun({ type: 'png', data: got.data, transformation: { width: Math.round(want), height: Math.round((want * got.h) / got.w) } });
}

async function imagePara(i: QImg, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.CENTER, indent?: number) {
  // imagem de alternativa (com recuo): 60% da coluna e no máximo 3 cm de altura
  const run = indent ? await imageRun(i, Math.round(COL_PX * 0.6), 113) : await imageRun(i, COL_PX);
  return run ? new Paragraph({ alignment: align, spacing: { before: 60, after: 60 }, indent: indent ? { left: indent } : undefined, children: [run] }) : null;
}

// ---------------------------------------------------------------- questões
const thin = { style: BorderStyle.SINGLE, size: 4, color: '000000' };

async function questionBlocks(q: ListQuestion, n: number) {
  const out: (Paragraph | Table)[] = [];
  out.push(
    new Paragraph({
      keepNext: true,
      spacing: { before: 160, after: 60 },
      children: [
        new TextRun({ text: `QUESTÃO ${String(n).padStart(2, '0')}`, bold: true }),
        // banca, ano, habilidade e estrelas da dificuldade, em letra pequena numa linha só
        new TextRun({ text: `  ${metaParts(q).join(' · ')}`, size: 14, color: '444444' }),
        ...(stars(q) ? [new TextRun({ text: ` ${'★'.repeat(stars(q))}`, size: 14, font: 'Segoe UI Symbol' })] : []),
      ],
    }),
  );
  for (const b of q.blocos) {
    if (b.tipo === 'texto') {
      if (b.estilo === 'fonte') out.push(...textParas(b.conteudo, { align: AlignmentType.RIGHT, size: 15 }));
      else if (b.estilo === 'titulo') out.push(...textParas(b.conteudo, { align: AlignmentType.LEFT, bold: true }));
      else out.push(...textParas(b.conteudo));
    } else if (b.tipo === 'equacao') {
      const m = omml(b.latex, true);
      out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: m ? [m] : [new TextRun(b.latex)] }));
    } else if (b.tipo === 'imagem' && !b.dividida) {
      const p = await imagePara(b);
      if (p) out.push(p);
    } else if (b.tipo === 'tabela') {
      const cell = (txt: string, head: boolean) =>
        new TableCell({
          borders: { top: thin, bottom: thin, left: thin, right: thin },
          margins: { top: 30, bottom: 30, left: 60, right: 60 },
          children: paragraphs(txt).length
            ? paragraphs(txt).map((segs) => new Paragraph({ alignment: AlignmentType.CENTER, children: runs(segs, { size: 18, bold: head }) }))
            : [new Paragraph('')],
        });
      const rows = [...(b.cabecalho.length ? [new TableRow({ tableHeader: true, children: b.cabecalho.map((c) => cell(c, true)) })] : [])];
      for (const r of b.linhas) rows.push(new TableRow({ children: r.map((c) => cell(c, false)) }));
      if (rows.length) out.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
      if (b.legenda) out.push(...textParas(b.legenda, { align: AlignmentType.CENTER, size: 16 }));
    }
  }
  const ia = altImagesToShow(q);
  for (const i of ia) {
    const p = await imagePara(i);
    if (p) out.push(p);
  }
  // letras desenhadas na imagem (sem recorte): não repete "A) B) C)…" vazias embaixo
  for (const a of ia.length && blankAlternatives(q) ? [] : q.alternativas) {
    const segs = paragraphs(a.texto);
    out.push(
      new Paragraph({
        spacing: { after: 40 },
        indent: { left: 340, hanging: 340 },
        keepLines: true,
        children: [new TextRun({ text: `${a.letra})\t`, bold: true }), ...(segs[0] ? runs(segs[0]) : [])],
        tabStops: [{ type: 'left', position: 340 }],
      }),
    );
    for (const more of segs.slice(1)) out.push(new Paragraph({ indent: { left: 340 }, spacing: { after: 40 }, children: runs(more) }));
    if (a.imagem) {
      const p = await imagePara(a.imagem, AlignmentType.LEFT, 340);
      if (p) out.push(p);
    }
  }
  return out;
}

export async function listDocx(title: string, qs: ListQuestion[], t: ListTemplate | null, opts: { answers?: boolean } = {}) {
  imgCache.clear();
  const top: (Paragraph | Table)[] = [];
  const body: (Paragraph | Table)[] = [];
  if (!t?.header_url)
    top.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: title, bold: true, size: 24 })] }));
  // logo abaixo do cabeçalho: disciplinas e, ao lado de cada uma, os assuntos
  for (const [d, a] of subjectsOf(qs))
    top.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: `${d}: `, bold: true, size: 18 }), new TextRun({ text: a.join(', '), size: 18 })],
      }),
    );
  if (subjectsOf(qs).length)
    top.push(new Paragraph({ spacing: { after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '999999', space: 4 } }, children: [] }));
  for (const [i, q] of qs.entries()) body.push(...(await questionBlocks(q, i + 1)));
  if (opts.answers) {
    body.push(new Paragraph({ children: [new PageBreak(), new TextRun({ text: 'Gabarito', bold: true, size: 22 })], spacing: { after: 120 } }));
    body.push(
      new Paragraph({
        children: qs.flatMap((q, i) => [
          new TextRun({ text: `${i + 1}. `, bold: true }),
          new TextRun({ text: `${q.status === 'anulada' ? 'Anulada' : q.gabarito || '–'}    ` }),
        ]),
      }),
    );
  }

  // cabeçalhos (1ª página e demais, ou o mesmo em todas) e rodapé (em todas) com as imagens do modelo
  const hs = headersOf(t);
  const headerRun = hs.first ? await imageRun({ url: hs.first.url, largura: TEXT_PX / 0.75 }, TEXT_PX) : null;
  const restRun = hs.rest ? await imageRun({ url: hs.rest.url, largura: TEXT_PX / 0.75 }, TEXT_PX) : null;
  const footerRun = t?.footer_url ? await imageRun({ url: t.footer_url, largura: (TEXT_PX / 0.75) * 1 }, TEXT_PX) : null;
  const footer = footerRun ? new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [footerRun] })] }) : undefined;

  const doc = new Document({
    title,
    creator: 'Curso Vértice',
    styles: { default: { document: { run: { font: 'Arial', size: SIZE }, paragraph: { spacing: { line: 252, lineRule: LineRuleType.AUTO } } } } },
    sections: [
      // topo em largura total (com o cabeçalho da 1ª página)
      {
        properties: {
          titlePage: Boolean(headerRun || restRun),
          page: { margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN, header: 360, footer: 360 } },
        },
        headers:
          headerRun || restRun
            ? {
                first: new Header({ children: headerRun ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [headerRun] })] : [] }),
                default: new Header({ children: restRun ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [restRun] })] : [] }),
              }
            : undefined,
        footers: footer ? { first: footer, default: footer } : undefined,
        children: top.length ? top : [new Paragraph({ children: [] })],
      },
      // questões em 2 colunas, na mesma página
      {
        properties: {
          type: SectionType.CONTINUOUS,
          page: { margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN, header: 360, footer: 360 } },
          column: { count: 2, space: GAP, separate: true },
        },
        headers:
          headerRun || restRun
            ? { default: new Header({ children: restRun ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [restRun] })] : [] }) }
            : undefined,
        footers: footer ? { default: footer } : undefined,
        children: body,
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}
