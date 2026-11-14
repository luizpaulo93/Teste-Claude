/**
 * Exporta em PDF o que foi escrito na live (trazido do caderno "Traço"): cada página vira uma imagem dentro
 * de um PDF montado aqui mesmo, no navegador. `pages` entrega os canvases das páginas em ordem.
 */
export async function exportPdf(pages: AsyncIterable<HTMLCanvasElement>, opts: { quality?: number; onProgress?: (n: number) => void } = {}) {
  const enc = new TextEncoder();
  const chunks: BlobPart[] = [];
  const offsets: number[] = [];
  let size = 0;
  const push = (data: string | Uint8Array) => {
    const b = typeof data === 'string' ? enc.encode(data) : data;
    chunks.push(b as BlobPart);
    size += b.length;
  };
  const obj = (n: number, body: () => void) => {
    offsets[n] = size;
    push(`${n} 0 obj\n`);
    body();
    push('\nendobj\n');
  };

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const kids: number[] = [];
  let n = 2; // 1 = catálogo, 2 = lista de páginas
  let count = 0;
  // largura da página no PDF: A4 (595,28 pontos)
  const PW = 595.28;

  for await (const canvas of pages) {
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', opts.quality ?? 0.9));
    if (!blob) continue;
    const jpeg = new Uint8Array(await blob.arrayBuffer());
    const W = PW.toFixed(2);
    const H = ((PW * canvas.height) / canvas.width).toFixed(2);
    const img = ++n;
    const content = ++n;
    const pg = ++n;
    obj(img, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
      push(jpeg);
      push('\nendstream');
    });
    const stream = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    obj(content, () => push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`));
    obj(pg, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${img} 0 R >> >> /Contents ${content} 0 R >>`));
    kids.push(pg);
    canvas.width = canvas.height = 0;
    count++;
    opts.onProgress?.(count);
  }

  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Count ${kids.length} /Kids [${kids.map((k) => k + ' 0 R').join(' ')}] >>`));
  const xref = size;
  let table = `xref\n0 ${n + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= n; i++) table += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  push(table);
  push(`trailer\n<< /Size ${n + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks, { type: 'application/pdf' });
}

export function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
