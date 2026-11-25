'use server';

import { revalidatePath } from 'next/cache';
import { fail, requireAdminAction } from '@/lib/admin/guard';
import { sql } from '@/lib/db';
import type { QAlternativa, QBloco } from '@/lib/question-types';
import { questionProblems, type PaperProblem } from '@/lib/questions';
import { formulaProblems, latexProblems, rich, richTex } from '@/lib/rich';

/** Um campo do editor para pré-visualizar: texto com fórmulas ($…$) ou LaTeX puro (bloco de equação). */
export interface PreviewField {
  kind: 'text' | 'tex';
  src: string;
}

/** Como cada campo fica na tela e o que ainda está errado nele (mesma checagem da importação). */
export async function previewFields(fields: PreviewField[]): Promise<{ html: string; problems: string[] }[]> {
  await requireAdminAction();
  return (Array.isArray(fields) ? fields : []).slice(0, 200).map((f) => {
    const src = String(f?.src ?? '').slice(0, 20000);
    try {
      return f?.kind === 'tex' ? { html: richTex(src), problems: latexProblems(src) } : { html: rich(src), problems: formulaProblems(src) };
    } catch {
      return { html: '', problems: ['não foi possível mostrar'] };
    }
  });
}

export interface QuestionDraft {
  blocos: QBloco[];
  alternativas: QAlternativa[];
  gabarito: string;
  resolucao: string;
  resolucao_blocos: QBloco[];
}

const s = (v: unknown, max = 20000) => (typeof v === 'string' ? v : '').slice(0, max);

/** Só os textos mudam: a estrutura (quantos blocos, tipos, imagens) fica a da questão importada. */
function mergeBlocks(orig: QBloco[], edit: unknown): QBloco[] {
  const e = Array.isArray(edit) ? (edit as Partial<QBloco>[]) : [];
  return orig.map((b, i) => {
    const n = e[i] as Record<string, unknown> | undefined;
    if (!n || n.tipo !== b.tipo) return b;
    if (b.tipo === 'texto') return { ...b, conteudo: s(n.conteudo) };
    if (b.tipo === 'equacao') return { ...b, latex: s(n.latex, 4000) };
    if (b.tipo === 'tabela') {
      const cab = Array.isArray(n.cabecalho) ? (n.cabecalho as unknown[]) : [];
      const lin = Array.isArray(n.linhas) ? (n.linhas as unknown[][]) : [];
      return {
        ...b,
        cabecalho: b.cabecalho.map((c, j) => (j < cab.length ? s(cab[j], 2000) : c)),
        linhas: b.linhas.map((r, j) => r.map((c, k) => (Array.isArray(lin[j]) && k < lin[j].length ? s(lin[j][k], 2000) : c))),
        legenda: b.legenda == null && !n.legenda ? b.legenda : s(n.legenda, 2000),
      };
    }
    return b;
  });
}

/** Problemas que sobraram na prova, com o link de cada questão. */
async function paperProblems(paperId: string) {
  const rows = await sql.query<{ id: string; numero: number; blocos: QBloco[]; alternativas: QAlternativa[]; resolucao: string; resolucao_blocos: QBloco[] }>(
    `select id, numero, blocos, alternativas, resolucao, resolucao_blocos from questions where paper_id = $1 order by numero`,
    [paperId],
  );
  const problems: (PaperProblem & { qid: string })[] = rows.flatMap((r) => questionProblems(r as unknown as Parameters<typeof questionProblems>[0]).map((p) => ({ ...p, qid: r.id })));
  await sql.exec(`update exam_papers set problems = $2 where id = $1`, [paperId, JSON.stringify(problems.slice(0, 300).map(({ qid: _q, ...p }) => p))]);
  return problems;
}

/** Salva a correção manual da questão e refaz a lista de problemas da prova. */
export async function saveQuestionEdit(id: string, draft: QuestionDraft): Promise<{ ok?: boolean; error?: string; remaining?: (PaperProblem & { qid: string })[] }> {
  try {
    await requireAdminAction();
    const q = await sql.one<{ paper_id: string; blocos: QBloco[]; alternativas: QAlternativa[]; resolucao: string; resolucao_blocos: QBloco[] }>(
      `select paper_id, blocos, alternativas, resolucao, resolucao_blocos from questions where id = $1`,
      [String(id ?? '').slice(0, 200)],
    );
    if (!q) return { error: 'Questão não encontrada.' };
    const alts = Array.isArray(draft?.alternativas) ? draft.alternativas : [];
    const alternativas = q.alternativas.map((a, i) => ({ ...a, texto: alts[i] && alts[i].letra === a.letra ? s(alts[i].texto, 8000) : a.texto }));
    const letters = alternativas.map((a) => a.letra);
    const gabarito = letters.includes(String(draft?.gabarito)) ? String(draft.gabarito) : '';
    const blocos = mergeBlocks(q.blocos, draft?.blocos);
    const resolucao_blocos = mergeBlocks(q.resolucao_blocos ?? [], draft?.resolucao_blocos);
    const resolucao = q.resolucao_blocos?.length ? q.resolucao : s(draft?.resolucao, 40000);
    await sql.exec(
      `update questions set blocos = $2, alternativas = $3, gabarito = coalesce(nullif($4, ''), gabarito), resolucao = $5, resolucao_blocos = $6, updated_at = now()
        where id = $1`,
      [id, JSON.stringify(blocos), JSON.stringify(alternativas), gabarito, resolucao, JSON.stringify(resolucao_blocos)],
    );
    const remaining = await paperProblems(q.paper_id);
    revalidatePath('/admin/questoes');
    revalidatePath(`/questoes/${id}`);
    return { ok: true, remaining };
  } catch (e) {
    return fail(e);
  }
}
