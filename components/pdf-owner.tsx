'use client';

import { createContext, useContext } from 'react';
import type { PdfOwner } from '@/lib/pdf-stamp';

/** Dados do aluno logado para carimbar os PDFs (null para o admin). */
const Ctx = createContext<PdfOwner | null>(null);

export function PdfOwnerProvider({ owner, children }: { owner: PdfOwner | null; children: React.ReactNode }) {
  return <Ctx.Provider value={owner}>{children}</Ctx.Provider>;
}

export const usePdfOwner = () => useContext(Ctx);
