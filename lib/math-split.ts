/**
 * Separa um texto em pedaços de texto e de fórmula ($…$ e $$…$$), lendo da esquerda para a direita
 * como o LaTeX faz — em vez de expressões regulares soltas, que erravam em casos comuns:
 *
 *  - "$\ell$$\dfrac{\sqrt2}{2}$" (duas fórmulas coladas): o "$$" do meio fecha uma e abre a outra,
 *    não é fórmula em destaque;
 *  - "Cada cifrão ($) indica…", "$$$" numa tabela de preços: cifrão sozinho é texto, não abre fórmula;
 *  - um "$" sem par não derruba mais as outras fórmulas do texto: só ele vira texto.
 *
 * O texto já deve vir com o cifrão de dinheiro ("\$", "R$ 14,00") trocado por uma marca (ver rich.ts).
 * Usado na tela, na checagem de erros, no PDF e no Word: todos leem o texto do mesmo jeito.
 */
export type MathPiece = { text: string } | { tex: string; display: boolean };

export interface MathSplit {
  pieces: MathPiece[];
  /** cifrões que pareciam abrir fórmula mas não têm par (viraram texto) */
  orphans: number;
}

/** caractere que não deixa um "$" abrir fórmula (cifrão sozinho: "($)", "$," …) */
const CANT_OPEN = /[),.;:!?\]}]/;

export function splitMath(s: string): MathSplit {
  const pieces: MathPiece[] = [];
  let orphans = 0;
  let text = '';
  const flushText = () => {
    if (text) pieces.push({ text });
    text = '';
  };
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch !== '$') {
      text += ch;
      i++;
      continue;
    }
    // quantos cifrões seguidos
    let run = 1;
    while (s[i + run] === '$') run++;

    // "$$$" ou mais: é texto (preço em cifrões), nunca fórmula
    if (run >= 3) {
      text += '$'.repeat(run);
      i += run;
      continue;
    }

    if (run === 2) {
      // $$…$$ em destaque: só se fechar com "$$" e não houver "$" sozinho no meio
      const close = s.indexOf('$$', i + 2);
      const body = close > 0 ? s.slice(i + 2, close) : '';
      // "Madeira $$ Carpete $$$$": cifrões cercados de espaço em volta de palavras comuns são preço, não fórmula
      const words = /^\s[\sA-Za-zÀ-ÖØ-öø-ÿ]*\s$/.test(body);
      if (close > 0 && body.trim() && !words && !body.includes('$') && !/\n\s*\n/.test(body)) {
        flushText();
        pieces.push({ tex: body, display: true });
        i = close + 2;
        continue;
      }
      // "$$" sem fechamento de destaque: cifrões de texto ("custa $$")
      if (i + 2 >= s.length || CANT_OPEN.test(s[i + 2]) || /\s/.test(s[i + 2])) {
        text += '$$';
        i += 2;
        continue;
      }
      // senão, o primeiro "$" é texto e o segundo pode abrir fórmula normal
      text += '$';
      i += 1;
      continue;
    }

    // um "$" só: abre fórmula se tiver par no mesmo parágrafo
    const next = s[i + 1];
    if (next === undefined || CANT_OPEN.test(next)) {
      text += '$';
      i++;
      continue;
    }
    const close = s.indexOf('$', i + 1);
    const body = close > 0 ? s.slice(i + 1, close) : '';
    // "$ 5 e $ 7": com espaço dos dois lados é cifrão de texto, não fórmula
    const loose = /\s/.test(next) && (close < 0 || /\s/.test(s[close - 1]));
    if (close < 0 || !body.trim() || /\n\s*\n/.test(body) || loose) {
      if (!loose) orphans++;
      text += '$';
      i++;
      continue;
    }
    flushText();
    pieces.push({ tex: body, display: false });
    i = close + 1;
  }
  flushText();
  return { pieces, orphans };
}
