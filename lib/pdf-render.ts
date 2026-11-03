import 'server-only';
import { existsSync } from 'node:fs';
import type { Browser } from 'puppeteer-core';
import { footerHeightMm, PAGE } from '@/lib/list-html';
import type { ListTemplate } from '@/lib/question-lists';

/** Chrome do servidor (na Vercel vem do @sparticuz/chromium; no computador, o Chrome instalado). */
async function launch(): Promise<Browser> {
  const puppeteer = await import('puppeteer-core');
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const chromium = (await import('@sparticuz/chromium')).default;
    return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
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
    return new Uint8Array(pdf);
  } finally {
    await browser.close().catch(() => {});
  }
}
