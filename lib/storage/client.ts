'use client';

export interface UploadResult {
  path: string;
  publicUrl: string;
}

/** Envia um arquivo direto do navegador para o armazenamento (R2 ou Supabase), sem passar pelo servidor. */
export async function uploadFile(kind: 'media' | 'materials', folder: string, file: Blob, contentType = file.type): Promise<UploadResult> {
  const res = await fetch('/api/storage/upload', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind, folder, contentType, size: file.size }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Falha no upload.');
  const put = await fetch(data.uploadUrl, { method: 'PUT', headers: data.headers, body: file });
  if (!put.ok) throw new Error('Falha ao enviar o arquivo.');
  return { path: data.path, publicUrl: data.publicUrl };
}

/** Pede um link temporário para abrir/baixar um PDF privado. */
export async function getFileUrl(path: string, downloadName?: string) {
  const q = new URLSearchParams({ path });
  if (downloadName) q.set('name', downloadName);
  const res = await fetch(`/api/storage/download?${q}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error || 'Arquivo indisponível.');
  return data.url as string;
}
