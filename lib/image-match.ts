/**
 * Encaixe das imagens escolhidas nas questões, pelo nome do arquivo citado no provas.json.
 * Tolerante ao que costuma mudar no caminho: maiúsculas, extensão (.png ↔ .webp ↔ .jpg), acentos gravados de
 * outro jeito (zip do Mac) e o mesmo nome em provas diferentes (aí vale a pasta da prova).
 */
const IMG_EXT = /\.(webp|png|jpe?g|gif|avif)$/i;
export const normName = (s: string) => s.normalize('NFC').toLowerCase().trim();
const stemOf = (s: string) => normName(s).replace(IMG_EXT, '');
const dirOf = (p: string) => normName(p).split('/').slice(0, -1).join('/');

export interface Candidate {
  name: string;
  /** caminho dentro do zip ou da pasta ("pacote/enem2018/img/q01.webp"); vazio se escolhida solta */
  path: string;
}

export function makeMatcher<T extends Candidate>(files: Iterable<T>) {
  const byName = new Map<string, T[]>();
  const byStem = new Map<string, T[]>();
  const add = (m: Map<string, T[]>, k: string, f: T) => m.set(k, [...(m.get(k) ?? []), f]);
  for (const f of files) {
    add(byName, normName(f.name), f);
    add(byStem, stemOf(f.name), f);
  }
  const candidates = (n: string) => byName.get(normName(n)) ?? byStem.get(stemOf(n)) ?? [];

  /** Arquivo de cada nome citado por uma prova (os que não acharam ficam de fora). */
  return function resolve(prova: string, names: Iterable<string>): Map<string, T> {
    const out = new Map<string, T>();
    const doubt: [string, T[]][] = [];
    const dirs = new Map<string, number>();
    for (const n of names) {
      const c = candidates(n);
      if (c.length === 1) {
        out.set(n, c[0]);
        const d = dirOf(c[0].path);
        dirs.set(d, (dirs.get(d) ?? 0) + 1);
      } else if (c.length > 1) doubt.push([n, c]);
    }
    // nome repetido em várias pastas: a pasta onde estão as outras imagens desta prova, ou a que tem o nome dela
    const top = [...dirs].sort((a, b) => b[1] - a[1])[0]?.[0];
    const p = normName(prova);
    for (const [n, c] of doubt)
      out.set(n, c.find((f) => top !== undefined && top !== '' && dirOf(f.path) === top) ?? c.find((f) => normName(f.path).includes(p)) ?? c[0]);
    return out;
  };
}
