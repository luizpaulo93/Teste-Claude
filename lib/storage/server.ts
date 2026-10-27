import 'server-only';
import { AwsClient } from 'aws4fetch';
import { createClient } from '@/lib/supabase/server';

/**
 * Armazenamento de arquivos.
 * - Com as variáveis R2_* configuradas: Cloudflare R2 (S3), com URLs assinadas.
 * - Sem elas: Supabase Storage (comportamento anterior), para nada quebrar.
 *
 * Dois "baldes" lógicos:
 *   media     → público (capas, banners, fotos das dúvidas)
 *   materials → privado (PDFs das aulas e dos simulados), só com link temporário
 */
export type BucketKind = 'media' | 'materials';

const env = {
  accountId: process.env.R2_ACCOUNT_ID ?? '',
  accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  bucketMedia: process.env.R2_BUCKET_MEDIA ?? '',
  bucketMaterials: process.env.R2_BUCKET_MATERIALS ?? '',
  publicUrl: (process.env.R2_PUBLIC_URL ?? '').replace(/\/+$/, ''),
  // Opcional: endpoint alternativo (testes ou jurisdição UE: https://<conta>.eu.r2.cloudflarestorage.com)
  endpoint: (process.env.R2_ENDPOINT ?? '').replace(/\/+$/, ''),
};

export const usingR2 = Boolean(env.accessKeyId && env.secretAccessKey && env.bucketMedia && env.bucketMaterials && (env.accountId || env.endpoint) && env.publicUrl);

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

/** URL para o navegador enviar o arquivo direto (PUT), válida por 10 minutos. */
export async function createUploadUrl(kind: BucketKind, key: string, contentType: string) {
  if (usingR2) {
    const url = new URL(objectUrl(kind, key));
    url.searchParams.set('X-Amz-Expires', '600');
    const signed = await client().sign(new Request(url, { method: 'PUT', headers: { 'content-type': contentType } }), { aws: { signQuery: true } });
    return {
      uploadUrl: signed.url,
      headers: { 'content-type': contentType },
      publicUrl: kind === 'media' ? publicUrlFor(key) : '',
    };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(kind).createSignedUploadUrl(key);
  if (error || !data) throw error ?? new Error('upload');
  return {
    uploadUrl: data.signedUrl,
    headers: { 'content-type': contentType, 'cache-control': 'max-age=31536000' },
    publicUrl: kind === 'media' ? supabase.storage.from('media').getPublicUrl(key).data.publicUrl : '',
  };
}

/** Link temporário para ler um arquivo privado. Quem chama já deve ter checado o acesso. */
export async function createDownloadUrl(key: string, expiresIn = 3600, downloadName?: string) {
  if (usingR2) {
    const url = new URL(objectUrl('materials', key));
    url.searchParams.set('X-Amz-Expires', String(expiresIn));
    if (downloadName) url.searchParams.set('response-content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
    const signed = await client().sign(new Request(url, { method: 'GET' }), { aws: { signQuery: true } });
    return signed.url;
  }
  const supabase = await createClient();
  const { data } = await supabase.storage.from('materials').createSignedUrl(key, expiresIn, downloadName ? { download: downloadName } : undefined);
  return data?.signedUrl ?? '';
}

/** Apaga arquivos (usado ao excluir aulas/simulados). Falhas não interrompem a ação. */
export async function removeObjects(kind: BucketKind, keys: string[]) {
  const list = keys.filter(Boolean);
  if (!list.length) return;
  if (usingR2) {
    await Promise.all(list.map((k) => client().fetch(objectUrl(kind, k), { method: 'DELETE' }).catch(() => null)));
    return;
  }
  const supabase = await createClient();
  await supabase.storage.from(kind).remove(list);
}
