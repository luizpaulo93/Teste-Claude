import 'server-only';
import { existsSync } from 'node:fs';
import type { Browser } from 'puppeteer-core';
import { footerHeightMm, HEADER_TOP_MM, imgHeightMm, PAGE } from '@/lib/list-html';
import { pdfFontsCss } from '@/lib/pdf-fonts';
import { headersOf, type ListTemplate } from '@/lib/question-lists';
import { footerText, SMALL_HEADER_MM, smallHeaderHtml } from '@/lib/vertice-brand';
import { fetchMedia } from '@/lib/storage/server';

const MM = 72 / 25.4;

/** Padrão Vértice: faixa menor no alto das páginas a partir da 2ª; rodapé com os dados do curso e o número da página. */
async function stampVertice(pdf: Uint8Array, bar: Uint8Array) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.load(pdf);
  const img = await doc.embedPng(bar);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = (PAGE.widthMm - 2 * PAGE.marginMm) * MM;
  const x = PAGE.marginMm * MM;
  const gray = rgb(0.45, 0.48, 0.55);
  for (const [i, page] of doc.getPages().entries()) {
    const { height } = page.getSize();
    if (i > 0) page.drawImage(img, { x, y: height - HEADER_TOP_MM * MM - SMALL_HEADER_MM * MM, width: w, height: SMALL_HEADER_MM * MM });
    const y = 9 * MM;
    page.drawLine({ start: { x, y: y + 9 }, end: { x: x + w, y: y + 9 }, thickness: 0.4, color: rgb(0.8, 0.82, 0.86) });
    page.drawText(footerText, { x, y, size: 7, font, color: gray });
    const num = String(i + 1);
    page.drawText(num, { x: x + w - bold.widthOfTextAtSize(num, 8), y, size: 8, font: bold, color: rgb(0.1, 0.12, 0.2) });
  }
  return new Uint8Array(await doc.save());
}

/** Põe a imagem do cabeçalho no alto das páginas (a 1ª só se o cabeçalho for o mesmo em todas). */
async function stampHeaders(pdf: Uint8Array, t: ListTemplate | null) {
  const { first, rest } = headersOf(t);
  const onFirst = Boolean(t?.header_all && first);
  if (!rest && !onFirst) return pdf;
  const [{ PDFDocument }, sharp] = await Promise.all([import('pdf-lib'), import('sharp').then((m) => m.default)]);
  const doc = await PDFDocument.load(pdf);
  const embed = async (url: string) => {
    const f = await fetchMedia(url);
    if (!f) return null;
    const png = await sharp(f.data)
      .flatten({ background: '#ffffff' })
      .png()
      .toBuffer();
    return doc.embedPng(png);
  };
  const imgs = new Map<string, Awaited<ReturnType<typeof embed>>>();
  const get = async (u: string) => {
    if (!imgs.has(u)) imgs.set(u, await embed(u));
    return imgs.get(u)!;
  };
  for (const [i, page] of doc.getPages().entries()) {
    const h = i === 0 ? (onFirst ? first : null) : rest;
    if (!h) continue;
    const image = await get(h.url);
    if (!image) continue;
    const { height } = page.getSize();
    const w = (PAGE.widthMm - 2 * PAGE.marginMm) * MM;
    const ih = imgHeightMm(h) * MM;
    page.drawImage(image, { x: PAGE.marginMm * MM, y: height - HEADER_TOP_MM * MM - ih, width: w, height: ih });
  }
  return new Uint8Array(await doc.save());
}

const CHROMIUM_PACK = 'https://github.com/Sparticuz/chromium/releases/download/v153.0.0/chromium-v153.0.0-pack.x64.tar';

/** Chrome do servidor (na Vercel vem do @sparticuz/chromium; no computador, o Chrome instalado). */
async function launch(): Promise<Browser> {
  const puppeteer = await import('puppeteer-core');
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const chromium = (await import('@sparticuz/chromium')).default;
    chromium.setGraphicsMode = false; // sem WebGL: abre mais rápido e usa menos memória
    // Chrome que vai junto com o app; se a Vercel não tiver incluído os arquivos, baixa o pacote oficial (fica em /tmp)
    const exe = await chromium.executablePath().catch(() => chromium.executablePath(CHROMIUM_PACK));
    // modo "shell": é o Chrome próprio para servidor (recomendado pelo pacote)
    return puppeteer.launch({ args: await puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' }), executablePath: exe, headless: 'shell' });
  }
  const local = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/google-chrome'].find((p) => p && existsSync(p));
  if (!local) throw new Error('Chrome não encontrado para gerar o PDF.');
  return puppeteer.launch({ executablePath: local, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
}

async function asDataUrl(url: string) {
  const f = await fetchMedia(url);
  return f ? `data:${f.type};base64,${f.data.toString('base64')}` : '';
}

/**
 * Coloca as imagens dentro do HTML (data URL) antes de gerar o PDF.
 * Deixar o Chrome baixar todas de uma vez do link público faz parte delas falhar.
 */
async function inlineImages(html: string) {
  const urls = [...new Set([...html.matchAll(/<img\b[^>]*?\ssrc="(https?:[^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&')))];
  const map = new Map<string, string>();
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(6, urls.length) }, async () => {
      while (next < urls.length) {
        const u = urls[next++];
        const d = await asDataUrl(u).catch(() => '');
        if (d) map.set(u, d);
      }
    }),
  );
  return html.replace(/(<img\b[^>]*?\ssrc=")(https?:[^"]+)"/g, (all, pre: string, src: string) => {
    const d = map.get(src.replace(/&amp;/g, '&'));
    return d ? `${pre}${d}"` : all;
  });
}

/** Transforma o HTML da lista em PDF (A4). O rodapé (imagem) sai em todas as páginas. */
export async function htmlToPdf(html: string, t: ListTemplate | null, vertice?: { title: string }): Promise<Uint8Array> {
  if (vertice) t = null; // padrão Vértice: cabeçalhos e rodapé próprios
  const footerMm = footerHeightMm(t);
  const footer = footerMm ? await asDataUrl(t!.footer_url) : '';
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setContent(await inlineImages(html), { waitUntil: 'load', timeout: 45_000 });
    await page.waitForNetworkIdle({ idleTime: 300, timeout: 20_000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: Boolean(footer),
      headerTemplate: '<span></span>',
      footerTemplate: footer
        ? `<div style="width:100%;padding:0 ${PAGE.marginMm}mm ${(PAGE.marginMm / 3).toFixed(1)}mm;margin:0;-webkit-print-color-adjust:exact"><img src="${footer}" style="display:block;width:100%;height:auto"></div>`
        : '<span></span>',
    });
    if (vertice) {
      // faixa menor das páginas seguintes: desenhada em HTML e fotografada (fica nítida, com as fontes embutidas)
      const bar = await browser.newPage();
      await bar.setViewport({ width: 698, height: 53, deviceScaleFactor: 3 });
      await bar.setContent(smallHeaderHtml(vertice.title, pdfFontsCss()), { waitUntil: 'load' });
      await bar.evaluate(() => document.fonts.ready);
      const png = await (await bar.$('.bar'))!.screenshot({ type: 'png' });
      return await stampVertice(new Uint8Array(pdf), new Uint8Array(png));
    }
    return await stampHeaders(new Uint8Array(pdf), t);
  } finally {
    await browser.close().catch(() => {});
  }
}
