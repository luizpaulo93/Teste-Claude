import { NextResponse, type NextRequest } from 'next/server';
import { lessonPlacement } from '@/lib/data';
import { emailKey, sql } from '@/lib/db';
import { getViewer } from '@/lib/session';
import { createDownloadUrl } from '@/lib/storage/server';
import { canSeeLive } from '@/lib/live';
import { canUseSpace } from '@/lib/mentoria-space';
import type { LiveSession, Simulado } from '@/lib/types';

/** Link temporário para um PDF privado — só para quem enxerga a aula ou o simulado. */
export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });
  const path = req.nextUrl.searchParams.get('path') ?? '';
  const name = (req.nextUrl.searchParams.get('name') ?? '').slice(0, 120);
  if (!path || path.length > 300) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });

  const [lessons, sims, blocks, lives, cycles] = await Promise.all([
    sql.query<{ id: string }>(`select id from lessons where material_paths @> array[$1::text] limit 5`, [path]),
    sql.query<Simulado>(`select is_published from simulados where pdf_path = $1 limit 5`, [path]),
    sql.query<{ space: string }>(`select space from mentoria_blocks where file_paths @> array[$1::text] limit 5`, [path]),
    sql.query<LiveSession>(`select * from live_sessions where material_paths @> array[$1::text] limit 5`, [path]),
    sql.query<{ mentoria_id: string }>(`select mentoria_id from mentoria_cycles where file_paths @> array[$1::text] limit 50`, [path]),
  ]);
  // O PDF abre se o usuário enxerga a aula em algum curso
  const lessonOk =
    (viewer.isAdmin && lessons.length > 0) || (await Promise.all(lessons.map((l) => lessonPlacement(viewer, l.id)))).some(Boolean);
  const simOk = sims.some((s) => viewer.isAdmin || (s.is_published && viewer.isMember));
  // Apostila da mentoria: só quem participa daquela mentoria; PDF da live: quem pode ver a live
  const blockOk = (await Promise.all(blocks.map((b) => canUseSpace(viewer, b.space)))).some(Boolean);
  const liveOk = (await Promise.all(lives.map((l) => canSeeLive(viewer, l)))).some(Boolean);
  // Apostila de um ciclo anterior: o próprio aluno (ou o mentor)
  const cycleOk = cycles.length > 0 && (viewer.isAdmin || cycles.some((c) => c.mentoria_id === emailKey(viewer.email)));
  if (!lessonOk && !simOk && !blockOk && !liveOk && !cycleOk) return NextResponse.json({ error: 'Arquivo indisponível.' }, { status: 404 });

  const url = await createDownloadUrl(path, 3600, name ? `${name.replace(/[\\/:*?"<>|]/g, '')}.pdf` : undefined);
  if (!url) return NextResponse.json({ error: 'Arquivo indisponível.' }, { status: 404 });
  return NextResponse.json({ url }, { headers: { 'cache-control': 'private, no-store' } });
}
