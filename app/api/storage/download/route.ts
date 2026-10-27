import { NextResponse, type NextRequest } from 'next/server';
import { getViewer } from '@/lib/session';
import { createDownloadUrl } from '@/lib/storage/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Link temporário para um PDF privado.
 * O acesso é conferido no banco com as regras do próprio aluno (RLS):
 * só encontra o arquivo quem enxerga a aula ou o simulado.
 */
export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });
  const path = req.nextUrl.searchParams.get('path') ?? '';
  const name = (req.nextUrl.searchParams.get('name') ?? '').slice(0, 120);
  if (!path || path.length > 300) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });

  const supabase = await createClient();
  const [{ data: mat }, { data: sim }] = await Promise.all([
    supabase.from('lesson_materials').select('id').eq('file_path', path).limit(1),
    supabase.from('simulados').select('id').eq('pdf_path', path).limit(1),
  ]);
  if (!mat?.length && !sim?.length) return NextResponse.json({ error: 'Arquivo indisponível.' }, { status: 404 });

  const url = await createDownloadUrl(path, 3600, name ? `${name.replace(/[\\/:*?"<>|]/g, '')}.pdf` : undefined);
  if (!url) return NextResponse.json({ error: 'Arquivo indisponível.' }, { status: 404 });
  return NextResponse.json({ url }, { headers: { 'cache-control': 'private, no-store' } });
}
