import { NextResponse, type NextRequest } from 'next/server';
import { db, fromQuery, getCatalogData } from '@/lib/db';
import { canSeeLesson, getSettings, getViewer } from '@/lib/session';
import { createDownloadUrl } from '@/lib/storage/server';
import type { Lesson, Simulado } from '@/lib/types';

/** Link temporário para um PDF privado — só para quem enxerga a aula ou o simulado. */
export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });
  const path = req.nextUrl.searchParams.get('path') ?? '';
  const name = (req.nextUrl.searchParams.get('name') ?? '').slice(0, 120);
  if (!path || path.length > 300) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });

  const [lessonsSnap, simsSnap, settings, catalog] = await Promise.all([
    db().collection('lessons').where('material_paths', 'array-contains', path).limit(5).get(),
    db().collection('simulados').where('pdf_path', '==', path).limit(5).get(),
    getSettings(),
    getCatalogData(),
  ]);
  const lessonOk = fromQuery<Lesson>(lessonsSnap).some((l) =>
    canSeeLesson(viewer, l, catalog.courses.find((c) => c.id === l.course_id), settings.restrict_to_student_list),
  );
  const simOk = fromQuery<Simulado>(simsSnap).some((s) => viewer.isAdmin || (s.is_published && viewer.isMember));
  if (!lessonOk && !simOk) return NextResponse.json({ error: 'Arquivo indisponível.' }, { status: 404 });

  const url = await createDownloadUrl(path, 3600, name ? `${name.replace(/[\\/:*?"<>|]/g, '')}.pdf` : undefined);
  if (!url) return NextResponse.json({ error: 'Arquivo indisponível.' }, { status: 404 });
  return NextResponse.json({ url }, { headers: { 'cache-control': 'private, no-store' } });
}
