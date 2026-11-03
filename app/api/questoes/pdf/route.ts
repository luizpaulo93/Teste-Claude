import { NextResponse, type NextRequest } from 'next/server';
import { listHtml } from '@/lib/list-html';
import { htmlToPdf } from '@/lib/pdf-render';
import { defaultTemplate, questionsOf } from '@/lib/question-lists';
import { filteredIds, readFilters } from '@/lib/questions';
import { getViewer } from '@/lib/session';

export const maxDuration = 60;
const LIMIT = 200;

/** Todas as questões do filtro num PDF (coluna dupla), com gabarito e resolução no fim. */
export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });
  if (!viewer.isMember && !viewer.isAdmin) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  const sp: Record<string, string[]> = {};
  for (const k of new Set(req.nextUrl.searchParams.keys())) sp[k] = req.nextUrl.searchParams.getAll(k);
  const f = readFilters(sp);
  const ids = await filteredIds(f, viewer.userId, LIMIT);
  if (ids.length < 3) return NextResponse.json({ error: 'Escolha um filtro com pelo menos 3 questões.' }, { status: 400 });
  if (ids.length > LIMIT) return NextResponse.json({ error: `Filtre até ${LIMIT} questões para baixar o PDF.` }, { status: 400 });
  const title = ['Questões', [...(f.disciplina ?? []), ...(f.assunto ?? [])].join(', ')].filter(Boolean).join(' – ');
  try {
    const [qs, t] = await Promise.all([questionsOf({ question_ids: ids }), defaultTemplate()]);
    // cabeçalho e rodapé das apostilas do curso
    const pdf = await htmlToPdf(listHtml(title, qs, t, { answers: true, resolutions: true }), t);
    return new NextResponse(pdf as BodyInit, {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="questoes.pdf"`, 'Cache-Control': 'private, no-store' },
    });
  } catch (e) {
    console.error('questões: falha no PDF', e);
    const why = viewer.isAdmin && e instanceof Error ? ` (${e.message.slice(0, 300)})` : '';
    return NextResponse.json({ error: `Não foi possível gerar o PDF agora. Tente de novo.${why}` }, { status: 500 });
  }
}
