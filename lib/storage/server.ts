import 'server-only';
import { AwsClient } from 'aws4fetch';

/**
 * Arquivos no Cloudflare R2 (S3), com URLs assinadas.
 *   media     → bucket público (capas, banners, fotos das dúvidas)
 *   materials → bucket privado (PDFs das aulas e dos simulados), só com link temporário
 */
export type BucketKind = 'media' | 'materials';

const clean = (v?: string) => (v ?? '').trim();
const env = {
  accountId: clean(process.env.R2_ACCOUNT_ID),
  accessKeyId: clean(process.env.R2_ACCESS_KEY_ID),
  secretAccessKey: clean(process.env.R2_SECRET_ACCESS_KEY),
  bucketMedia: clean(process.env.R2_BUCKET_MEDIA),
  bucketMaterials: clean(process.env.R2_BUCKET_MATERIALS),
  publicUrl: clean(process.env.R2_PUBLIC_URL).replace(/\/+$/, ''),
  // Opcional: endpoint alternativo (testes ou jurisdição UE: https://<conta>.eu.r2.cloudflarestorage.com)
  endpoint: clean(process.env.R2_ENDPOINT).replace(/\/+$/, ''),
};

export function storageProblem(): string | null {
  const missing = [
    ['R2_ACCOUNT_ID', env.accountId || env.endpoint],
    ['R2_ACCESS_KEY_ID', env.accessKeyId],
    ['R2_SECRET_ACCESS_KEY', env.secretAccessKey],
    ['R2_BUCKET_MEDIA', env.bucketMedia],
    ['R2_BUCKET_MATERIALS', env.bucketMaterials],
    ['R2_PUBLIC_URL', env.publicUrl],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k);
  return missing.length ? `Armazenamento não configurado. Faltam na Vercel: ${missing.join(', ')} (veja docs/CLOUDFLARE-R2.md).` : null;
}

let aws: AwsClient | null = null;
function client() {
  if (!aws) aws = new AwsClient({ accessKeyId: env.accessKeyId, secretAccessKey: env.secretAccessKey, service: 's3', region: 'auto' });
  return aws;
}

function objectUrl(kind: BucketKind, key: string) {
  const base = env.endpoint || `https://${env.accountId}.r2.cloudflarestorage.com`;
  const bucket = kind === 'media' ? env.bucketMedia : env.bucketMaterials;
  return `${base}/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

export function publicUrlFor(key: string) {
  return `${env.publicUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

/** URL para o navegador enviar o arquivo direto ao R2 (PUT), válida por 10 minutos. */
export async function createUploadUrl(kind: BucketKind, key: string, contentType: string) {
  const problem = storageProblem();
  if (problem) throw new Error(problem);
  const url = new URL(objectUrl(kind, key));
  url.searchParams.set('X-Amz-Expires', '600');
  const signed = await client().sign(new Request(url, { method: 'PUT', headers: { 'content-type': contentType } }), { aws: { signQuery: true } });
  return { uploadUrl: signed.url, headers: { 'content-type': contentType }, publicUrl: kind === 'media' ? publicUrlFor(key) : '' };
}

/** Link temporário para ler um arquivo privado. Quem chama já deve ter checado o acesso. */
export async function createDownloadUrl(key: string, expiresIn = 3600, downloadName?: string) {
  if (!key || storageProblem()) return '';
  const url = new URL(objectUrl('materials', key));
  url.searchParams.set('X-Amz-Expires', String(expiresIn));
  if (downloadName) url.searchParams.set('response-content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
  const signed = await client().sign(new Request(url, { method: 'GET' }), { aws: { signQuery: true } });
  return signed.url;
}

/** Apaga arquivos (ao excluir aulas/simulados). Falhas não interrompem a ação. */
export async function removeObjects(kind: BucketKind, keys: string[]) {
  const list = keys.filter(Boolean);
  if (!list.length || storageProblem()) return;
  await Promise.all(list.map((k) => client().fetch(objectUrl(kind, k), { method: 'DELETE' }).catch(() => null)));
}
