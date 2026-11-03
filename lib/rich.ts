import 'server-only';
import katex from 'katex';
import { Marked } from 'marked';

/**
 * Texto das questões: Markdown (negrito, itálico, listas) com fórmulas LaTeX em $...$ (ou $$...$$ em destaque).
 * Vira HTML no servidor — o aluno não baixa o KaTeX nem o Markdown, só o resultado.
 */
const md = new Marked({ gfm: true, breaks: true, async: false });

const DOLLAR = '';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tex = (src: string, display: boolean) => katex.renderToString(src, { displayMode: display, throwOnError: false, output: 'html', strict: 'ignore' });

export function rich(src: string | null | undefined, inline = false): string {
  let s = String(src ?? '');
  if (!s.trim()) return '';
  // dinheiro não é fórmula: "\$" e "R$ 14,00" / "(R$)" viram cifrão de verdade
  s = s.replace(/\\\$/g, DOLLAR).replace(/(?<![$\w\\])R\$(?![A-Za-z\\{_^])/g, `R${DOLLAR}`);
  const math: string[] = [];
  const keep = (html: string) => `${math.push(html) - 1}`;
  // $ sem par: mostra como está, sem tentar montar fórmula
  if ((s.match(/\$/g)?.length ?? 0) % 2 === 0) {
    s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => keep(tex(t, true))).replace(/\$([^$]+?)\$/g, (_, t) => keep(tex(t, false)));
  }
  // negrito/itálico em LaTeX fora das fórmulas: \textbf{..}, \textit{..}, \emph{..}, \underline{..}
  for (let i = 0; i < 4; i++) {
    const before = s;
    s = s
      .replace(/\\textbf\{([^{}]*)\}/g, '<b>$1</b>')
      .replace(/\\(?:textit|emph)\{([^{}]*)\}/g, '<i>$1</i>')
      .replace(/\\underline\{([^{}]*)\}/g, '<u>$1</u>');
    if (s === before) break;
  }
  let html = (inline ? md.parseInline(esc(s)) : md.parse(esc(s))) as string;
  html = html.replace(/&lt;(\/?)([biu])&gt;/g, '<$1$2>');
  html = html.replace(/(\d+)/g, (_, i) => math[Number(i)]).replace(new RegExp(DOLLAR, 'g'), '$');
  return html;
}

export const richTex = (latex: string) => tex(latex, true);
