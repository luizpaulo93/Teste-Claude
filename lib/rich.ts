import 'server-only';
import katex from 'katex';
import { Marked } from 'marked';
import { splitMath } from '@/lib/math-split';

/**
 * Texto das questões: Markdown (negrito, itálico, listas) com fórmulas LaTeX em $...$ (ou $$...$$ em destaque).
 * Vira HTML no servidor — o aluno não baixa o KaTeX nem o Markdown, só o resultado.
 */
const md = new Marked({ gfm: true, breaks: true, async: false });

const DOLLAR = '';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** dentro da fórmula, o cifrão escrito "\$" (ex.: \mathrm{R\$}) volta a ser "\$" para o KaTeX */
const texSrc = (src: string) => uprightAccents(src.replaceAll(DOLLAR, '\\$'));

const TEXT_CMD = /\\(?:text|textrm|textnormal|mathrm|mathit|mathbf|mathsf|mbox|textbf|textit|operatorname)\s*\{/g;
/** Aplica `fn` só nos trechos da fórmula fora de \text{…}/\mathrm{…} (chaves dentro de chaves contam). */
function outsideText(t: string, fn: (part: string) => string, keep = true) {
  const re = new RegExp(TEXT_CMD.source, 'g');
  let out = '';
  let i = 0;
  for (let m = re.exec(t); m; m = re.exec(t)) {
    out += fn(t.slice(i, m.index));
    let depth = 1;
    let j = m.index + m[0].length;
    for (; j < t.length && depth; j++) {
      if (t[j] === '{') depth++;
      else if (t[j] === '}') depth--;
    }
    if (keep) out += t.slice(m.index, j);
    i = j;
    re.lastIndex = j;
  }
  return out + fn(t.slice(i));
}

/**
 * Palavra com acento dentro da fórmula (h_{máx}, v_{média}) é texto: vai em letra reta, como nos livros,
 * em vez do itálico de variável (e sem o aviso de "caractere estranho").
 */
function uprightAccents(t: string) {
  if (!/[À-ÖØ-öø-ÿ]/.test(t)) return t;
  return outsideText(t, (part) => part.replace(/(?<![\\A-Za-zÀ-ÖØ-öø-ÿ])[A-Za-zÀ-ÖØ-öø-ÿ]*[À-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ]*/g, (w) => `\\text{${w}}`));
}
// marcas internas de montagem nunca podem chegar ao KaTeX (era o "□0□" vermelho na tela)
const tex = (src: string, display: boolean) =>
  katex.renderToString(breakable(texSrc(src.replace(/[\uE000\uE001]/g, ''))), { displayMode: display, throwOnError: false, output: 'html', strict: 'ignore' });

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

/**
 * Cifrão de dinheiro (não abre fórmula): "\$", "R$ 14,00", "(R$)" e "R$/kWh".
 * "R$)" só é dinheiro com o parêntese aberto logo antes: em "($R_1>R$)" o cifrão fecha a fórmula.
 */
function money(s: string, mark: string) {
  return s.replace(/\\\$/g, mark).replace(/(?<![$\w\\])R\$(?=\s?\d|\/)|(?<=\()R\$(?=\))/g, `R${mark}`);
}

/** Tira os comandos de texto da fórmula (\text{…}, \mathrm{…} com chaves dentro de chaves): ali acento é normal. */
const withoutText = (t: string) => outsideText(t, (p) => p, false);

export function rich(src: string | null | undefined, inline = false): string {
  let s = String(src ?? '');
  if (!s.trim()) return '';
  // dinheiro não é fórmula: "\$", "R$ 14,00", "(R$)" e "R$/kWh" viram cifrão de verdade
  s = money(s, DOLLAR);
  const math: string[] = [];
  const keep = (html: string) => `${math.push(html) - 1}`;
  // fórmulas lidas da esquerda para a direita (ver math-split.ts): "$a$$b$" são duas fórmulas coladas,
  // "($)" é cifrão de texto, e um "$" sem par vira texto sem estragar as outras fórmulas
  s = splitMath(s)
    .pieces.map((p) => ('tex' in p ? keep(tex(p.tex, p.display)) : p.text.replaceAll('$', DOLLAR)))
    .join('');
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

/**
 * Fórmulas com defeito num texto (para avisar na importação): erro do KaTeX ou caracteres que não
 * existem numa fórmula de verdade (sinal de texto corrompido ao extrair do PDF, ex.: \frac{´}{c}).
 */
export function formulaProblems(src: string | null | undefined): string[] {
  // dinheiro não é fórmula ("\$", "R$ 14,00"), como no rich()
  // mesma preparação da montagem (rich): o que passa aqui abre igual na tela do aluno
  const s = money(String(src ?? ''), DOLLAR);
  if (!s.includes('$')) return [];
  const { pieces, orphans } = splitMath(s);
  const out: string[] = [];
  if (orphans) out.push('cifrão ($) sem par — se for dinheiro, escreva \\$');
  for (const p of pieces) if ('tex' in p) out.push(...latexProblems(p.tex));
  // trava final: monta como o aluno vê; se algum pedaço sair em vermelho (erro do KaTeX), avisa
  if (!out.length && rich(src).includes('katex-error')) out.push('fórmula com erro (aparece em vermelho)');
  return out;
}
export function latexProblems(latex: string): string[] {
  const t = texSrc(String(latex ?? ''));
  if (!t.trim()) return [];
  try {
    // exatamente como vai para a tela (com as quebras de linha das equações químicas)
    katex.renderToString(breakable(t), { throwOnError: true, strict: 'ignore' });
  } catch (e) {
    void e;
    return ['fórmula com erro (não abre)'];
  }
  // fora de \text{…}: aspas ou símbolos de fonte trocada (cópia errada do PDF) não aparecem em fórmula.
  // Letra com acento é normal (h_{máx}): vira texto reto em uprightAccents.
  const bare = withoutText(t);
  const odd = bare.match(/[\uFFFD\u0000-\u0008\u000E-\u001F\uE000-\uF8FF]|["´¨¥¤¦§¶¬¯]/) ?? String(latex ?? '').match(/[ÃÂ][\u0080-\u00BF]/);
  if (odd) return [`símbolo estranho na fórmula: "${odd[0].replace(/[\u0000-\u001F]/g, '?')}" (provável erro ao copiar do PDF)`];
  return [];
}
