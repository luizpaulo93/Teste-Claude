import 'server-only';
import sharp from 'sharp';

/**
 * Imagem única com as 5 alternativas desenhadas (A, B, C, D, E uma embaixo da outra): recorta em uma
 * imagem por alternativa, pelas faixas em branco entre elas. Só aceita o recorte se tiver certeza
 * (cada pedaço com a letra desenhada à esquerda, ou faixas em branco bem maiores que as outras).
 */
export async function splitBands(buf: Buffer, n: number): Promise<{ data: Buffer; w: number; h: number }[] | null> {
  if (n < 2) return null;
  const { data, info } = await sharp(buf).flatten({ background: '#ffffff' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const noise = Math.max(1, Math.round(W * 0.002));
  const inkRow = (y: number, x0 = 0, x1 = W) => {
    let c = 0;
    for (let x = x0; x < x1; x++) if (data[y * W + x] < 170) c++;
    return c;
  };
  const rows = Array.from({ length: H }, (_, y) => inkRow(y) > noise);
  const first = rows.indexOf(true);
  const last = rows.lastIndexOf(true);
  if (first < 0) return null;
  // faixas em branco entre o começo e o fim do desenho
  const gaps: { a: number; b: number; len: number }[] = [];
  for (let y = first; y <= last; y++) {
    if (rows[y]) continue;
    const a = y;
    while (y <= last && !rows[y]) y++;
    gaps.push({ a, b: y - 1, len: y - a });
  }
  if (gaps.length < n - 1) return null;
  const byLen = [...gaps].sort((x, y) => y.len - x.len);
  const chosen = byLen.slice(0, n - 1);
  if (chosen[chosen.length - 1].len < 3) return null;
  const cuts = chosen.sort((x, y) => x.a - y.a).map((g) => Math.round((g.a + g.b) / 2));
  const bounds = [first, ...cuts, last + 1];
  const segs = bounds.slice(0, -1).map((top, i) => ({ top, bottom: bounds[i + 1] }));
  if (segs.some((s) => s.bottom - s.top < 8)) return null;

  // confiança: letra desenhada na faixa esquerda de cada pedaço, ou faixas escolhidas bem maiores que a próxima
  const left = Math.max(4, Math.round(W * 0.16));
  const hasLetter = segs.every((s) => {
    for (let y = s.top; y < s.bottom; y++) if (inkRow(y, 0, left) > 0) return true;
    return false;
  });
  const next = byLen[n - 1]?.len ?? 0;
  const clear = next === 0 || next <= byLen[n - 2].len * 0.6;
  if (!hasLetter && !clear) return null;

  // letra desenhada à esquerda (o app já mostra a letra): primeira coluna de tinta, separada do resto por um vão.
  // Só tira se estiver na mesma coluna em todos os pedaços (é a letra, não parte do desenho).
  const firstRun = (top: number, bottom: number) => {
    const col = (x: number) => {
      for (let y = top; y < bottom; y++) if (data[y * W + x] < 170) return true;
      return false;
    };
    let x = 0;
    while (x < W && !col(x)) x++;
    const start = x;
    while (x < W && col(x)) x++;
    const end = x;
    let gap = 0;
    while (x < W && !col(x)) (x++, gap++);
    return { start, end, gap, next: x };
  };
  const runs = segs.map((s) => firstRun(s.top, s.bottom));
  const aligned =
    hasLetter &&
    runs.every((r) => r.end > r.start && r.end - r.start < W * 0.16 && r.gap >= 6 && r.next < W) &&
    Math.max(...runs.map((r) => r.start)) - Math.min(...runs.map((r) => r.start)) <= 8;
  const cutLeft = aligned ? Math.max(...runs.map((r) => r.end)) + 2 : 0;

  const out: { data: Buffer; w: number; h: number }[] = [];
  for (const s of segs) {
    const top = Math.max(0, s.top - 3);
    const height = Math.min(H, s.bottom + 3) - top;
    const left0 = Math.max(0, Math.min(cutLeft, Math.min(...runs.map((r) => r.next)) - 2));
    const band = await sharp(buf)
      .flatten({ background: '#ffffff' })
      .extract({ left: left0, top, width: W - left0, height })
      .png()
      .toBuffer();
    const piece = await sharp(band)
      .trim({ background: '#ffffff', threshold: 12 })
      .extend({ top: 4, bottom: 4, left: 4, right: 4, background: '#ffffff' })
      .webp({ quality: 92 })
      .toBuffer({ resolveWithObject: true });
    out.push({ data: piece.data, w: piece.info.width, h: piece.info.height });
  }
  return out;
}

/**
 * Imagem muito alta (ocuparia boa parte da coluna e deixaria espaço em branco): corta em pedaços de até
 * `pieceH` pixels, sempre numa faixa em branco (nunca no meio do desenho). Sem faixa em branco: fica inteira.
 */
export async function splitTall(buf: Buffer, pieceH: number): Promise<{ data: Buffer; w: number; h: number }[] | null> {
  const { data, info } = await sharp(buf).flatten({ background: '#ffffff' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  if (H <= pieceH * 1.3) return null;
  const noise = Math.max(1, Math.round(W * 0.002));
  const blank = Array.from({ length: H }, (_, y) => {
    let c = 0;
    for (let x = 0; x < W; x++) if (data[y * W + x] < 225) c++;
    return c <= noise;
  });
  // meio da faixa em branco (de pelo menos 3 linhas) mais perto do alvo, entre `from` e `to`
  const gapNear = (from: number, to: number, target: number) => {
    let best = -1;
    for (let y = Math.max(1, from); y < Math.min(H - 1, to); y++) {
      if (!blank[y]) continue;
      let e = y;
      while (e < H && blank[e]) e++;
      if (e - y >= 3) {
        const mid = Math.round((y + e) / 2);
        if (best < 0 || Math.abs(mid - target) < Math.abs(best - target)) best = mid;
      }
      y = e;
    }
    return best;
  };
  const cuts: number[] = [];
  let top = 0;
  while (H - top > pieceH * 1.3) {
    const target = top + pieceH;
    const cut = gapNear(top + Math.round(pieceH * 0.45), Math.min(H, target + Math.round(pieceH * 0.3)), target);
    if (cut < 0) break;
    cuts.push(cut);
    top = cut;
  }
  if (!cuts.length) return null;
  const bounds = [0, ...cuts, H];
  const out: { data: Buffer; w: number; h: number }[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const piece = await sharp(buf)
      .flatten({ background: '#ffffff' })
      .extract({ left: 0, top: bounds[i], width: W, height: bounds[i + 1] - bounds[i] })
      .webp({ quality: 92 })
      .toBuffer({ resolveWithObject: true });
    out.push({ data: piece.data, w: piece.info.width, h: piece.info.height });
  }
  return out;
}
