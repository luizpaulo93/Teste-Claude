'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import type { ProvaIn } from '@/lib/question-types';
import { attachImages, knownImages, savePaper, splitAlternatives, splitTallImages } from '@/lib/questions';
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
  await admin();
  await sql.exec(`delete from exam_papers where id = $1`, [id]);
  revalidatePath('/admin/questoes');
  revalidatePath('/questoes');
  return {};
}

/** Questões já importadas: recorta as imagens com as alternativas e coloca cada pedaço na sua letra. */
export async function organizeAlternatives() {
  await admin();
  const papers = await sql.query<{ id: string }>(`select id from exam_papers`);
  let n = 0;
  for (const p of papers) n += (await splitAlternatives(p.id).catch(() => 0)) + (await splitTallImages(p.id).catch(() => 0));
  revalidatePath('/admin/questoes');
  revalidatePath('/questoes', 'layout');
  return { done: n };
}
