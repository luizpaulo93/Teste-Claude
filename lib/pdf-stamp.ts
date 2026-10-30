'use client';

import { useEffect, useState } from 'react';

export interface PdfOwner {
  name: string;
  cpf?: string;
  email?: string;
  phone?: string;
}

/** Remove acentos e símbolos (a fonte padrão do PDF só tem ASCII). */
const ascii = (s: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();

const cpfMask = (cpf: string) => {
  const d = cpf.replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : d;
};

const cache = new Map<string, string>();

/**
 * Baixa o PDF e carimba em TODAS as páginas os dados do aluno (nome, e-mail, CPF e telefone):
 * uma faixa no rodapé, outra no topo e uma marca d'água grande na diagonal. Assim, quem compartilha
 * o arquivo leva junto a própria identificação. Devolve um endereço local (blob) para abrir ou baixar.
 * Se algo falhar, devolve o link original (o aluno nunca fica sem o material).
 */
export async function stampedPdfUrl(url: string, owner: PdfOwner | null | undefined): Promise<string> {
  const name = ascii(owner?.name ?? '').toUpperCase();
  const cpf = ascii(cpfMask(owner?.cpf ?? ''));
  const email = ascii(owner?.email ?? '').toLowerCase();
  const phone = ascii(owner?.phone ?? '');
  if (!url || (!name && !cpf && !email)) return url;
  const key = `${url.split('?')[0]}|${name}|${cpf}|${email}|${phone}`;
  if (cache.has(key)) return cache.get(key)!;
  try {
    const [{ PDFDocument, StandardFonts, rgb, degrees }, res] = await Promise.all([import('pdf-lib'), fetch(url)]);
    if (!res.ok) return url;
    const doc = await PDFDocument.load(await res.arrayBuffer(), { ignoreEncryption: true });
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const parts = [name, email, cpf && `CPF ${cpf}`, phone && `TEL ${phone}`].filter(Boolean).join('  |  ');
    const text = `USO EXCLUSIVO DE ${parts} - PROIBIDO COMPARTILHAR`;
    const mark = [name, cpf && `CPF ${cpf}`].filter(Boolean).join(' - ') || email;
    for (const page of doc.getPages()) {
      const { width, height } = page.getSize();
      const size = Math.max(5.5, Math.min(8, ((width - 28) / Math.max(40, text.length)) * 1.9));
      const w = font.widthOfTextAtSize(text, size);
      const x = Math.max(10, (width - w) / 2);
      page.drawText(text, { x, y: 9, size, font, color: rgb(0.4, 0.4, 0.45), opacity: 0.8 });
      page.drawText(text, { x, y: height - 9 - size, size, font, color: rgb(0.4, 0.4, 0.45), opacity: 0.8 });
      // Marca d'água na diagonal, no meio da página
      const big = Math.min(28, Math.max(12, (Math.hypot(width, height) * 0.75) / Math.max(10, mark.length) / 0.55));
      const mw = bold.widthOfTextAtSize(mark, big);
      const ang = Math.atan2(height, width);
      page.drawText(mark, {
        x: width / 2 - (mw / 2) * Math.cos(ang) + (big / 3) * Math.sin(ang),
        y: height / 2 - (mw / 2) * Math.sin(ang) - (big / 3) * Math.cos(ang),
        size: big,
        font: bold,
        color: rgb(0.55, 0.55, 0.6),
        opacity: 0.16,
        rotate: degrees((ang * 180) / Math.PI),
      });
    }
    const bytes = await doc.save();
    const blob = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
    cache.set(key, blob);
    return blob;
  } catch {
    return url;
  }
}

/** Versão em hook para quem exibe o PDF direto (caderno do simulado). */
export function useStampedPdf(url: string, owner: PdfOwner | null | undefined) {
  const [out, setOut] = useState('');
  const name = owner?.name ?? '';
  const cpf = owner?.cpf ?? '';
  const email = owner?.email ?? '';
  const phone = owner?.phone ?? '';
  useEffect(() => {
    let alive = true;
    setOut('');
    if (!url) return;
    stampedPdfUrl(url, { name, cpf, email, phone }).then((u) => alive && setOut(u));
    return () => {
      alive = false;
    };
  }, [url, name, cpf, email, phone]);
  return out;
}
