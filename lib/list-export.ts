import 'server-only';
import { listDocx } from '@/lib/list-docx';
import { listHtml } from '@/lib/list-html';
import { getTemplate, questionsOf, type QList } from '@/lib/question-lists';
import { htmlToPdf } from '@/lib/pdf-render';

/** Gera o arquivo da lista (PDF ou Word) com o cabeçalho/rodapé escolhido. */
export async function exportList(list: QList, format: 'pdf' | 'docx', opts: { answers?: boolean } = {}) {
  const [qs, t] = await Promise.all([questionsOf(list), getTemplate(list.template_id)]);
  if (format === 'docx') return listDocx(list.title, qs, t, opts);
  return htmlToPdf(listHtml(list.title, qs, t, opts), t);
}

export const fileNameOf = (title: string, ext: string) => `${title.replace(/[\\/:*?"<>|]/g, '').trim() || 'lista'}.${ext}`;
