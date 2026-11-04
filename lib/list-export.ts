import 'server-only';
import { listDocx } from '@/lib/list-docx';
import { listHtml } from '@/lib/list-html';
import { defaultTemplate, getTemplate, questionsOf, type QList } from '@/lib/question-lists';
import { htmlToPdf } from '@/lib/pdf-render';

/** Gera o arquivo da lista (PDF ou Word) com o cabeçalho/rodapé escolhido. */
export async function exportList(list: QList, format: 'pdf' | 'docx', opts: Parameters<typeof listHtml>[3] = {}) {
  const [qs, own] = await Promise.all([questionsOf(list), getTemplate(list.template_id)]);
  if (format === 'docx') return listDocx(list.title, qs, own ?? (await defaultTemplate()), { answers: opts?.answers });
  // PDF: modelo de imagem escolhido pelo professor; sem ele, o padrão Vértice (disciplinas, nome e nº de questões no cabeçalho)
  if (own) return htmlToPdf(listHtml(list.title, qs, own, opts), own);
  return htmlToPdf(listHtml(list.title, qs, null, { ...opts, vertice: true }), null, { title: list.title });
}

export const fileNameOf = (title: string, ext: string) => `${title.replace(/[\\/:*?"<>|]/g, '').trim() || 'lista'}.${ext}`;
