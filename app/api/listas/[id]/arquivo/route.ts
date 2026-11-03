import { NextResponse, type NextRequest } from 'next/server';
import { exportList, fileNameOf } from '@/lib/list-export';
import { canSeeList, getList } from '@/lib/question-lists';
import { getViewer } from '@/lib/session';

export const maxDuration = 60;

/**
 * Baixa a lista: aluno só em PDF (sem gabarito); admin em PDF ou Word, com gabarito no fim se quiser.
 * ?formato=pdf|docx&gabarito=1
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });
  const list = await getList((await params).id);
  if (!list || !(await canSeeList(viewer, list))) return NextResponse.json({ error: 'Lista não encontrada.' }, { status: 404 });
  const format = req.nextUrl.searchParams.get('formato') === 'docx' ? 'docx' : 'pdf';
  if (format === 'docx' && !viewer.isAdmin) return NextResponse.json({ error: 'Só o professor baixa em Word.' }, { status: 403 });
  const answers = viewer.isAdmin && req.nextUrl.searchParams.get('gabarito') === '1';
  try {
    const data = await exportList(list, format, { answers });
    const name = fileNameOf(list.title, format);
    return new NextResponse(data as BodyInit, {
      headers: {
        'Content-Type': format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    console.error('lista: falha ao gerar', e);
    return NextResponse.json({ error: 'Não foi possível gerar o arquivo agora. Tente de novo.' }, { status: 500 });
  }
}
