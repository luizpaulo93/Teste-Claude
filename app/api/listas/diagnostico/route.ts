import { NextResponse } from 'next/server';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pdfFontsCss } from '@/lib/pdf-fonts';
import { htmlToPdf } from '@/lib/pdf-render';
import { getViewer } from '@/lib/session';

export const maxDuration = 60;

/** Só para o admin: testa, passo a passo, se o servidor consegue gerar PDF (mostra onde falha). */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  const steps: { passo: string; ok: boolean; ms: number; info?: string }[] = [];
  const step = async (passo: string, fn: () => Promise<string | void> | string | void) => {
    const t = Date.now();
    try {
      const info = await fn();
      steps.push({ passo, ok: true, ms: Date.now() - t, info: info || undefined });
      return true;
    } catch (e) {
      steps.push({ passo, ok: false, ms: Date.now() - t, info: e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 600) : String(e) });
      return false;
    }
  };
  await step('ambiente', () => `node ${process.version} · vercel=${Boolean(process.env.VERCEL)} · cwd=${process.cwd()}`);
  await step('arquivos do Chrome no pacote', () => {
    const bin = join(process.cwd(), 'node_modules', '@sparticuz', 'chromium', 'bin', 'chromium.br');
    return existsSync(bin) ? 'incluídos' : 'não incluídos (vai baixar o pacote oficial)';
  });
  await step('fontes embutidas', () => `${Math.round(pdfFontsCss().length / 1024)} KB`);
  await step('gerar PDF de teste', async () => {
    const pdf = await htmlToPdf('<!doctype html><html><body style="font-family:Arimo"><h1>Teste de PDF</h1><p>Olá, ação, 2 → 3, x²</p></body></html>', null);
    return `${pdf.length} bytes`;
  });
  return NextResponse.json({ ok: steps.every((s) => s.ok), steps });
}
