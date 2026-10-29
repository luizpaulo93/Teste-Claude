import { NextResponse, type NextRequest } from 'next/server';
import { lessonPlacement } from '@/lib/data';
import { sql } from '@/lib/db';
import { getViewer } from '@/lib/session';
import { createDownloadUrl } from '@/lib/storage/server';
import type { Simulado } from '@/lib/types';

/** Link temporário para um PDF privado — só para quem enxerga a aula ou o simulado. */
export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });
  const path = req.nextUrl.searchParams.get('path') ?? '';
  const name = (req.nextUrl.searchParams.get('name') ?? '').slice(0, 120);
  if (!path || path.length > 300) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });

  const [lessons, sims] = await Promise.all([
    sql.query<{ id: string }>(`select id from lessons where material_paths @> array[$1::text] limit 5`, [path]),
    sql.query<Simulado>(`select is_published from simulados where pdf_path = $1 limit 5`, [path]),
  ]);
  // O PDF abre se o usuário enxerga a aula em algum curso
  const lessonOk =
    (viewer.isAdmin && lessons.length > 0) || (await Promise.all(lessons.map((l) => lessonPlacement(viewer, l.id)))).some(Boolean);
  const simOk = sims.some((s) => viewer.isAdmin || (s.is_published && viewer.isMember));
  if (!lessonOk && !simOk) return NextResponse.json({ error: 'Arquivo indisponível.' }, { status: 404 });

  const url = await createDownloadUrl(path, 3600, name ? `${name.replace(/[\\/:*?"<>|]/g, '')}.pdf` : undefined);
  if (!url) return NextResponse.json({ error: 'Arquivo indisponível.' }, { status: 404 });
  return NextResponse.json({ url }, { headers: { 'cache-control': 'private, no-store' } });
}
