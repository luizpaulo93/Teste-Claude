import { NextResponse, type NextRequest } from 'next/server';
import { getViewer } from '@/lib/session';
import { createUploadUrl, storageProblem } from '@/lib/storage/server';

const SAFE_FOLDER = /^[a-z0-9][a-z0-9/_-]{0,120}$/i;
const MAX = 10 * 1024 * 1024;

/**
 * Várias URLs de envio de uma vez (importação de questões com centenas de imagens):
 * uma ida ao servidor para até 100 imagens, em vez de uma por imagem. Só o admin.
 */
export async function POST(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { folder?: string; files?: { contentType?: string; size?: number }[] } | null;
  const folder = String(body?.folder ?? '')
    .replace(/\.\.+/g, '')
    .replace(/^\/+|\/+$/g, '');
  const files = Array.isArray(body?.files) ? body.files.slice(0, 100) : [];
  if (!SAFE_FOLDER.test(folder) || !files.length) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
  const problem = storageProblem();
  if (problem) return NextResponse.json({ error: problem }, { status: 503 });
  try {
    const out = await Promise.all(
      files.map(async (f) => {
        const ct = String(f?.contentType ?? '');
        const size = Number(f?.size ?? 0);
        if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(ct) || size <= 0 || size > MAX) return { error: 'Imagem inválida ou muito grande (máx. 10 MB).' };
        const key = `${folder}/${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}.${ct.split('/')[1].replace('jpeg', 'jpg')}`;
        return { ...(await createUploadUrl('media', key, ct)), path: key };
      }),
    );
    return NextResponse.json({ items: out });
  } catch {
    return NextResponse.json({ error: 'Armazenamento indisponível.' }, { status: 500 });
  }
}
