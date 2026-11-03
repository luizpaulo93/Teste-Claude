import 'server-only';
import { existsSync } from 'node:fs';
import type { Browser } from 'puppeteer-core';
import { footerHeightMm, HEADER_TOP_MM, imgHeightMm, PAGE } from '@/lib/list-html';
import { headersOf, type ListTemplate } from '@/lib/question-lists';

const MM = 72 / 25.4;

/** Põe a imagem do cabeçalho no alto das páginas (a 1ª só se o cabeçalho for o mesmo em todas). */
async function stampHeaders(pdf: Uint8Array, t: ListTemplate | null) {
  const { first, rest } = headersOf(t);
  const onFirst = Boolean(t?.header_all && first);
  if (!rest && !onFirst) return pdf;
  const [{ PDFDocument }, sharp] = await Promise.all([import('pdf-lib'), import('sharp').then((m) => m.default)]);
  const doc = await PDFDocument.load(pdf);
  const embed = async (url: string) => {
    const r = await fetch(url);
    if (!r.ok) return null;
    const png = await sharp(Buffer.from(await r.arrayBuffer()))
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
  const r = await fetch(url);
  if (!r.ok) return '';
  const type = r.headers.get('content-type') || 'image/png';
  return `data:${type};base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`;
}

/** Transforma o HTML da lista em PDF (A4). O rodapé (imagem) sai em todas as páginas. */
export async function htmlToPdf(html: string, t: ListTemplate | null): Promise<Uint8Array> {
  const footerMm = footerHeightMm(t);
  const footer = footerMm ? await asDataUrl(t!.footer_url) : '';
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 45_000 });
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
    return await stampHeaders(new Uint8Array(pdf), t);
  } finally {
    await browser.close().catch(() => {});
  }
}
