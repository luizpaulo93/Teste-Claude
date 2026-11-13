'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { questionHtml } from '@/lib/list-html';
import { resolutionHtml } from '@/lib/resolution';
import { adminFilterOptions, adminSearch, adminSearchIds, deleteQuestions, itemsOf, type AdminFilters } from '@/lib/question-lists';
import { getViewer } from '@/lib/session';

async function admin() {
  const v = await getViewer();
  if (!v?.isAdmin) throw new Error('Acesso negado.');
  return v;
}

const clean = (f: AdminFilters): AdminFilters => {
  const out: AdminFilters = {};
  for (const k of ['vestibular', 'disciplina', 'area', 'banca', 'ano', 'habilidade', 'assunto', 'especifico', 'texto', 'prova'] as const) {
    const v = f?.[k];
    if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, 200);
  }
  return out;
};

export async function searchBank(f: AdminFilters, page = 1) {
  await admin();
  return adminSearch(clean(f), Math.max(1, Math.min(500, Math.round(page) || 1)), 30);
}

export async function idsForFilter(f: AdminFilters) {
  await admin();
  return adminSearchIds(clean(f));
}

export async function bankOptions() {
  await admin();
  return adminFilterOptions();
}

/** Questão completa (com gabarito) para o professor conferir antes de escolher. */
export async function previewQuestion(id: string) {
  await admin();
  const q = await sql.one<Parameters<typeof questionHtml>[0]>(
    `select q.*, p.exame, p.ano as paper_ano from questions q join exam_papers p on p.id = q.paper_id where q.id = $1`,
    [id],
  );
  if (!q) return null;
  return {
    html: questionHtml(q, 0).replace(/QUESTÃO 00 ?/, ''),
    gabarito: q.status === 'anulada' ? 'Anulada' : q.gabarito,
    // resolução (com as imagens no lugar) para o professor conferir
    resolucao: resolutionHtml(q),
  };
}

/** Dados das questões escolhidas (na ordem). */
export async function itemsByIds(ids: string[]) {
  await admin();
  return itemsOf((Array.isArray(ids) ? ids : []).filter((i) => typeof i === 'string').slice(0, 500));
}

/** Exclui várias questões de uma vez. Precisa digitar "excluir" para confirmar. */
export async function deleteManyQuestions(ids: string[], confirm: string) {
  await admin();
  if (confirm.trim().toLowerCase() !== 'excluir') return { error: 'Digite "excluir" para confirmar.' };
  const list = (Array.isArray(ids) ? ids : []).filter((i) => typeof i === 'string' && i.length < 160).slice(0, 5000);
  const n = await deleteQuestions(list);
  revalidatePath('/admin/questoes', 'layout');
  revalidatePath('/questoes', 'layout');
  return { deleted: n };
}
