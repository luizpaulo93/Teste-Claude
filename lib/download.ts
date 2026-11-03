'use client';

/**
 * Baixa um arquivo gerado pelo servidor sem sair da página. Se o servidor responder com erro,
 * mostra a mensagem em vez de salvar um arquivo estranho (ex.: o texto do erro em JSON).
 */
export async function fetchFile(url: string, expect: 'pdf' | 'docx') {
  const res = await fetch(url);
  const type = res.headers.get('content-type') ?? '';
  const okType = expect === 'pdf' ? type.includes('application/pdf') : type.includes('wordprocessingml');
  if (!res.ok || !okType) {
    const msg = type.includes('json') ? (await res.json().catch(() => ({}))).error : '';
    throw new Error(msg || 'Não foi possível gerar o arquivo agora. Tente de novo.');
  }
  return res.blob();
}

export function saveBlob(blob: Blob | string, name: string) {
  const url = typeof blob === 'string' ? blob : URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (typeof blob !== 'string') setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const safeName = (title: string, ext: string) => `${title.replace(/[\\/:*?"<>|]/g, '').trim() || 'lista'}.${ext}`;
