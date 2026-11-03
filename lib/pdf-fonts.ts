import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Fontes embutidas no HTML do PDF: o servidor (Vercel) não tem fontes instaladas e não deve depender
 * da internet na hora de gerar. Arimo = mesmas medidas da Arial; KaTeX = fórmulas.
 */
let css: string | null = null;
const mod = (...p: string[]) => join(process.cwd(), 'node_modules', ...p);
const b64 = (file: string) => readFileSync(file).toString('base64');

export function pdfFontsCss() {
  if (css) return css;
  // alfabeto latino (com acentos), latino estendido e grego (α, β, Δ…), cada um na sua faixa de caracteres
  const ranges: Record<string, string> = {
    latin:
      'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
    'latin-ext':
      'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
    greek: 'U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF',
  };
  const arimo = Object.entries(ranges)
    .flatMap(([sub, range]) =>
      (
        [
          ['400', 'normal'],
          ['700', 'normal'],
          ['400', 'italic'],
          ['700', 'italic'],
        ] as const
      ).map(
        ([w, s]) =>
          `@font-face{font-family:Arimo;font-style:${s};font-weight:${w};font-display:block;unicode-range:${range};src:url(data:font/woff2;base64,${b64(mod('@fontsource', 'arimo', 'files', `arimo-${sub}-${w}-${s}.woff2`))}) format("woff2")}`,
      ),
    )
    .join('\n');
  const katex = readFileSync(mod('katex', 'dist', 'katex.min.css'), 'utf8').replace(
    /src:url\(fonts\/([^)]+?)\.woff2\)[^;}]*/g,
    (_, name) => `src:url(data:font/woff2;base64,${b64(mod('katex', 'dist', 'fonts', `${name}.woff2`))}) format("woff2")`,
  );
  css = `${arimo}\n${katex}`;
  return css;
}
