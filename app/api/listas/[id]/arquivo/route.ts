import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { exportList, fileNameOf } from '@/lib/list-export';
import { canSeeList, getList } from '@/lib/question-lists';
import { getViewer } from '@/lib/session';

export const maxDuration = 60;

/**
 * Baixa a lista.
 * Admin: PDF ou Word, com gabarito no fim se quiser (?formato=pdf|docx&gabarito=1).
 * Aluno: só PDF, com nome, CPF e e-mail dele e o aviso de direitos autorais, sem ano/dificuldade nas questões.
 *   ?parte=questoes (padrão) | resolucoes (só gabarito e resoluções) | tudo (questões + resoluções)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });
  const list = await getList((await params).id);
  if (!list || !(await canSeeList(viewer, list))) return NextResponse.json({ error: 'Lista não encontrada.' }, { status: 404 });
  const sp = req.nextUrl.searchParams;
  const format = sp.get('formato') === 'docx' ? 'docx' : 'pdf';
  if (format === 'docx' && !viewer.isAdmin) return NextResponse.json({ error: 'Só o professor baixa em Word.' }, { status: 403 });
  const parte = sp.get('parte') === 'resolucoes' ? 'resolucoes' : sp.get('parte') === 'tudo' ? 'tudo' : 'questoes';
  if (parte !== 'questoes' && !viewer.isAdmin && !list.owner_id && list.mode === 'teste') {
    // teste mandado pelo professor: resoluções só depois de finalizar
    const done = await sql.one(`select 1 from list_finishes where list_id = $1 and user_id = $2`, [list.id, viewer.userId]);
    if (!done) return NextResponse.json({ error: 'As resoluções ficam disponíveis quando você finalizar o teste.' }, { status: 403 });
  }
  const student = viewer.isAdmin
    ? null
    : { name: viewer.profile.full_name || viewer.pdfOwner?.name || '', cpf: viewer.pdfOwner?.cpf ?? '', email: viewer.email };
  const answers = (viewer.isAdmin && sp.get('gabarito') === '1') || parte !== 'questoes';
  try {
    const data = await exportList(list, format, {
      answers,
      resolutions: parte !== 'questoes',
      onlyResolutions: parte === 'resolucoes',
      hideMeta: !viewer.isAdmin,
      student,
    });
    const suffix = parte === 'resolucoes' ? ' (resoluções)' : parte === 'tudo' ? ' (com resoluções)' : '';
    const name = fileNameOf(`${list.title}${suffix}`, format);
    return new NextResponse(data as BodyInit, {
      headers: {
        'Content-Type': format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    console.error('lista: falha ao gerar', e);
    // o professor vê a causa (ajuda a resolver); o aluno vê só o aviso
    const why = viewer.isAdmin && e instanceof Error ? ` (${e.message.slice(0, 300)})` : '';
    return NextResponse.json({ error: `Não foi possível gerar o arquivo agora. Tente de novo.${why}` }, { status: 500 });
  }
}
