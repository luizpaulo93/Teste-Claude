import { NextResponse, type NextRequest } from 'next/server';
import { getViewer } from '@/lib/session';
import { createUploadUrl, storageProblem, type BucketKind } from '@/lib/storage/server';

const LIMITS: Record<BucketKind, number> = { media: 10 * 1024 * 1024, materials: 50 * 1024 * 1024 };
const SAFE_FOLDER = /^[a-z0-9][a-z0-9/_-]{0,120}$/i;

/** Gera a URL para o navegador enviar um arquivo direto ao armazenamento, depois de checar a permissão. */
export async function POST(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { kind?: string; folder?: string; contentType?: string; size?: number } | null;
  const kind = body?.kind === 'materials' ? 'materials' : body?.kind === 'media' ? 'media' : null;
  const contentType = String(body?.contentType ?? '');
  const size = Number(body?.size ?? 0);
  let folder = String(body?.folder ?? '').replace(/\.\.+/g, '').replace(/^\/+|\/+$/g, '');
  if (!kind || !SAFE_FOLDER.test(folder)) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
  if (size <= 0 || size > LIMITS[kind]) return NextResponse.json({ error: `Arquivo muito grande (máx. ${LIMITS[kind] / 1024 / 1024} MB).` }, { status: 400 });

  if (kind === 'materials') {
    if (!viewer.isAdmin) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    if (contentType !== 'application/pdf') return NextResponse.json({ error: 'Envie um PDF.' }, { status: 400 });
  } else {
    if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(contentType)) return NextResponse.json({ error: 'Envie uma imagem.' }, { status: 400 });
    if (!viewer.isAdmin) {
      // Aluno só envia foto de dúvida, dentro da própria pasta
      if (!viewer.isMember) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
      folder = `doubts/${viewer.userId}`;
    }
  }

  const ext = kind === 'materials' ? 'pdf' : contentType.split('/')[1].replace('jpeg', 'jpg');
  const key = `${folder}/${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const problem = storageProblem();
  if (problem) return NextResponse.json({ error: problem }, { status: 503 });
  try {
    const r = await createUploadUrl(kind, key, contentType);
    return NextResponse.json({ ...r, path: key });
  } catch {
    return NextResponse.json({ error: 'Armazenamento indisponível.' }, { status: 500 });
  }
}
