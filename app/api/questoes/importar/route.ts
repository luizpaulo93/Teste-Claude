import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import type { ProvaIn } from '@/lib/question-types';
import { attachImages, savePaper } from '@/lib/questions';
import { getViewer } from '@/lib/session';

export const maxDuration = 60;

/**
 * Importação de provas pelo admin (rota comum, não ação do servidor): as ações do Next rodam uma de cada vez
 * e redesenham a página a cada chamada; aqui os lotes de imagens são encaixados em paralelo e a página
 * só é atualizada no fim ("done").
 */
export async function POST(req: NextRequest) {
  const v = await getViewer();
  if (!v?.isAdmin) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  const body = (await req.json().catch(() => null)) as
    | { op: 'paper'; prova: ProvaIn; have?: Record<string, string> }
    | { op: 'attach'; paperId: string; urls: Record<string, string> }
    | { op: 'done' }
    | null;
  try {
    if (body?.op === 'paper') {
      const r = await savePaper(body.prova, body.have ?? {}, v.userId);
      return NextResponse.json({ ok: true, ...r });
    }
    if (body?.op === 'attach') {
      const urls = Object.fromEntries(
        Object.entries(body.urls ?? {})
          .filter(([k, u]) => typeof k === 'string' && typeof u === 'string')
          .slice(0, 200),
      );
      const n = await attachImages(String(body.paperId).slice(0, 130), urls);
      return NextResponse.json({ ok: true, questions: n });
    }
    if (body?.op === 'done') {
      revalidatePath('/admin/questoes');
      revalidatePath('/questoes');
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao gravar.' }, { status: 500 });
  }
}
