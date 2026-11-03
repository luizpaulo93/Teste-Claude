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
const tex = (src: string, display: boolean) =>
  katex.renderToString(breakable(src), { displayMode: display, throwOnError: false, output: 'html', strict: 'ignore' });

/**
 * \mathrm{A + B \rightarrow C} vira \mathrm{A} + \mathrm{B} \rightarrow \mathrm{C}: o KaTeX não quebra linha
 * dentro de um grupo, então equações químicas longas passariam da tela do celular. Separadas, quebram
 * nos sinais de + e nas setas, com a mesma aparência.
 */
const OPS = /^( \+ |\\(?:long)?rightarrow|\\rightleftharpoons|\\leftrightarrow|\\longleftrightarrow|\\xrightarrow(?:\[[^\]]*\])?\{[^{}]*\}| = )/;
function breakable(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const at = src.indexOf('\\mathrm{', i);
    if (at < 0) break;
    out += src.slice(i, at);
    // fim do grupo (chaves balanceadas)
    let depth = 0;
    let j = at + 7;
    for (; j < src.length; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}' && --depth === 0) break;
    }
    if (j >= src.length) return out + src.slice(at);
    const body = src.slice(at + 8, j);
    const parts: string[] = [];
    let cur = '';
    let d = 0;
    for (let k = 0; k < body.length; ) {
      const ch = body[k];
      if (ch === '{') d++;
      if (ch === '}') d--;
      const m = d === 0 ? body.slice(k).match(OPS) : null;
      if (m) {
        parts.push(cur, m[1]);
        cur = '';
        k += m[1].length;
        continue;
      }
      cur += ch;
      k++;
    }
    parts.push(cur);
    out += parts.length > 1 ? parts.map((p, n) => (n % 2 ? p : p.trim() ? `\\mathrm{${p.trim()}}` : '')).join(' ') : src.slice(at, j + 1);
    i = j + 1;
  }
  return out + src.slice(i);
}

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
  // "1." ou "2)" no começo da linha é texto (ex.: alternativa "1."), não início de lista numerada
  s = s.replace(/^(\s*\d+)([.)])(?=\s|$)/gm, '$1\\$2');
  let html = (inline ? md.parseInline(esc(s)) : md.parse(esc(s))) as string;
  html = html.replace(/&lt;(\/?)([biu])&gt;/g, '<$1$2>');
  html = html.replace(/(\d+)/g, (_, i) => math[Number(i)]).replace(new RegExp(DOLLAR, 'g'), '$');
  return html;
}

export const richTex = (latex: string) => tex(latex, true);
