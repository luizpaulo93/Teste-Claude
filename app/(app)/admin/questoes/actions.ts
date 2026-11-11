'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import type { ProvaIn } from '@/lib/question-types';
import { attachImages, deletePapers, knownImages, savePaper } from '@/lib/questions';
import { getViewer } from '@/lib/session';

async function admin() {
  const v = await getViewer();
  if (!v?.isAdmin) throw new Error('Acesso negado.');
  return v;
}

/**
 * Antes de importar: quais provas já existem e quais imagens o app já tem (não reenvia)
 * ou ainda espera (para encaixar imagens enviadas sem o JSON).
 */
export async function checkImport(ids: string[]) {
  await admin();
  const clean = ids.filter((i) => typeof i === 'string' && i.length < 130).slice(0, 50);
  const existing = clean.length ? (await sql.query<{ id: string }>(`select id from exam_papers where id = any($1::text[])`, [clean])).map((r) => r.id) : [];
  const { have, want } = await knownImages();
  return { existing, have, want };
}

export async function importPaper(prova: ProvaIn, urls: Record<string, string>) {
  const v = await admin();
  try {
    const r = await savePaper(prova, urls ?? {}, v.userId);
    revalidatePath('/admin/questoes');
    revalidatePath('/questoes');
    return { ok: true as const, ...r };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : 'Falha ao gravar a prova.' };
  }
}

/** Imagens enviadas depois do JSON: encaixa pelo nome do arquivo. */
export async function attachPaperImages(paperId: string, urls: Record<string, string>) {
  await admin();
  const n = await attachImages(String(paperId).slice(0, 130), urls ?? {});
  revalidatePath('/admin/questoes');
  revalidatePath('/questoes');
  return { ok: true as const, questions: n };
}

export async function deletePaper(id: string) {
  await deleteManyPapers([id]);
  return {};
}

/** Exclui várias provas de uma vez (com as questões delas). */
export async function deleteManyPapers(ids: string[]) {
  await admin();
  const n = await deletePapers(Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : []);
  revalidatePath('/admin/questoes');
  revalidatePath('/questoes');
  return { n };
}
