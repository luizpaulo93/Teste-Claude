'use client';

import { useEffect, useState } from 'react';

export interface PdfOwner {
  name: string;
  cpf?: string;
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
 * Baixa o PDF e carimba em TODAS as páginas: "DOCUMENTO EXCLUSIVO - ALUNO(A): NOME | CPF - PROIBIDO COMPARTILHAR"
 * (igual ao MemberClass). Devolve um endereço local (blob) para abrir ou baixar.
 * Se algo falhar, devolve o link original (o aluno nunca fica sem o material).
 */
export async function stampedPdfUrl(url: string, owner: PdfOwner | null | undefined): Promise<string> {
  const name = ascii(owner?.name ?? '').toUpperCase();
  const cpf = ascii(cpfMask(owner?.cpf ?? ''));
  if (!url || (!name && !cpf)) return url;
  const key = `${url.split('?')[0]}|${name}|${cpf}`;
  if (cache.has(key)) return cache.get(key)!;
  try {
    const [{ PDFDocument, StandardFonts, rgb }, res] = await Promise.all([import('pdf-lib'), fetch(url)]);
    if (!res.ok) return url;
    const doc = await PDFDocument.load(await res.arrayBuffer(), { ignoreEncryption: true });
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const parts = [name && `ALUNO(A): ${name}`, cpf && `CPF: ${cpf}`].filter(Boolean).join('  |  ');
    const text = `DOCUMENTO EXCLUSIVO - ${parts} - PROIBIDO COMPARTILHAR`;
    for (const page of doc.getPages()) {
      const { width } = page.getSize();
      const size = Math.max(6.5, Math.min(8.5, (width / Math.max(40, text.length)) * 1.45));
      const w = font.widthOfTextAtSize(text, size);
      page.drawText(text, { x: Math.max(14, (width - w) / 2), y: 10, size, font, color: rgb(0.42, 0.42, 0.46), opacity: 0.72 });
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
  useEffect(() => {
    let alive = true;
    setOut('');
    if (!url) return;
    stampedPdfUrl(url, { name, cpf }).then((u) => alive && setOut(u));
    return () => {
      alive = false;
    };
  }, [url, name, cpf]);
  return out;
}
