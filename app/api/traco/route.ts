import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { getViewer } from '@/lib/session';
import { isDocId } from '@/lib/utils';
import type { LessonMaterial } from '@/lib/types';
import { addLiveMaterials } from '@/app/(app)/admin/live-actions';

/**
 * Cadernos do estúdio (editor Traço): cadernos, páginas e o que foi escrito. Rota comum (não ação do servidor):
 * as ações do Next rodam uma de cada vez — aqui o salvamento da escrita não espera a consulta da live.
 * Cada traço é uma linha: salvar um traço é leve, não importa quanto a página já tenha.
 */
const ID = /^[\w-]{1,48}$/;
const okId = (s: unknown): s is string => typeof s === 'string' && ID.test(s);
/** traço até ~300 KB; imagem até ~1,3 MB */
const MAX_ITEM = 1_400_000;

type Body = {
  op: 'boot' | 'getnb' | 'putnb' | 'delnb' | 'getpage' | 'putpage' | 'delpage' | 'items' | 'addpdf';
  live: string;
  id?: string;
  nb?: { id: string; name?: string; paper?: unknown; orient?: string; pages?: string[] };
  page?: { id: string; nb: string; w: number; h: number; bgRef?: { path: string; n: number } | null };
  pg?: string;
  d?: string[];
  p?: { id: string }[];
  file?: { title: string; path: string; size: string };
};

function cleanNb(nb: Body['nb']) {
  if (!nb || !okId(nb.id)) return null;
  const paper = (nb.paper && typeof nb.paper === 'object' ? nb.paper : {}) as { type?: string; size?: number };
  return {
    id: nb.id,
    name: String(nb.name ?? 'Caderno').slice(0, 80) || 'Caderno',
    paper: { type: ['blank', 'lined', 'grid', 'dots'].includes(String(paper.type)) ? paper.type : 'blank', size: Math.min(120, Math.max(12, Number(paper.size) || 40)) },
    orient: nb.orient === 'l' ? 'l' : 'p',
    pages: (Array.isArray(nb.pages) ? nb.pages : []).filter(okId).slice(0, 1000),
    updated: Date.now(),
  };
}

export async function POST(req: NextRequest) {
  const v = await getViewer();
  if (!v?.isAdmin) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  const b = (await req.json().catch(() => null)) as Body | null;
  if (!b || !isDocId(b.live)) return NextResponse.json({ error: 'Inválido.' }, { status: 400 });
  const live = b.live;
  try {
    switch (b.op) {
      case 'boot': {
        const [nbs, row] = await Promise.all([
          sql.query<{ data: { id: string; name: string; updated: number } }>(`select data from live_tr_nbs where live_id = $1 order by updated_at desc`, [live]),
          sql.one<{ materials: LessonMaterial[] | null }>(`select materials from live_sessions where id = $1`, [live]),
        ]);
        return NextResponse.json({
          nbs: nbs.map((r) => ({ id: r.data.id, name: r.data.name, updated: r.data.updated })),
          materials: (row?.materials ?? []).map((m) => ({ id: m.id, title: m.title, path: m.file_path })),
        });
      }
      case 'getnb': {
        if (!okId(b.id)) break;
        const r = await sql.one<{ data: unknown }>(`select data from live_tr_nbs where live_id = $1 and id = $2`, [live, b.id]);
        return NextResponse.json({ nb: r?.data ?? null });
      }
      case 'putnb': {
        const nb = cleanNb(b.nb);
        if (!nb) break;
        await sql.exec(
          `insert into live_tr_nbs (live_id, id, data) values ($1, $2, $3) on conflict (live_id, id) do update set data = excluded.data, updated_at = now()`,
          [live, nb.id, JSON.stringify(nb)],
        );
        return NextResponse.json({ ok: true });
      }
      case 'delnb': {
        if (!okId(b.id)) break;
        const r = await sql.one<{ data: { pages?: string[] } }>(`select data from live_tr_nbs where live_id = $1 and id = $2`, [live, b.id]);
        const pages = (r?.data.pages ?? []).filter(okId);
        if (pages.length) {
          await sql.exec(`delete from live_tr_items where live_id = $1 and page_id = any($2)`, [live, pages]);
          await sql.exec(`delete from live_tr_pages where live_id = $1 and id = any($2)`, [live, pages]);
        }
        await sql.exec(`delete from live_tr_nbs where live_id = $1 and id = $2`, [live, b.id]);
        return NextResponse.json({ ok: true });
      }
      case 'getpage': {
        if (!okId(b.id)) break;
        const [pg, items] = await Promise.all([
          sql.one<{ nb: string; data: Record<string, unknown> }>(`select nb, data from live_tr_pages where live_id = $1 and id = $2`, [live, b.id]),
          sql.query<{ data: string }>(`select data from live_tr_items where live_id = $1 and page_id = $2 order by n`, [live, b.id]),
        ]);
        if (!pg) return NextResponse.json({ page: null });
        const list: unknown[] = [];
        for (const r of items)
          try {
            list.push(JSON.parse(r.data));
          } catch {}
        return NextResponse.json({ page: { ...pg.data, id: b.id, nb: pg.nb }, items: list });
      }
      case 'putpage': {
        const p = b.page;
        if (!p || !okId(p.id) || !okId(p.nb)) break;
        const ref = p.bgRef && typeof p.bgRef.path === 'string' && /^[\w/.-]{1,200}$/.test(p.bgRef.path) ? { path: p.bgRef.path, n: Math.max(1, Math.round(Number(p.bgRef.n) || 1)) } : null;
        const data = { w: Math.min(5000, Math.max(50, Number(p.w) || 1000)), h: Math.min(10000, Math.max(50, Number(p.h) || 1414)), ...(ref ? { bgRef: ref } : {}) };
        await sql.exec(
          `insert into live_tr_pages (live_id, id, nb, data) values ($1, $2, $3, $4) on conflict (live_id, id) do update set nb = excluded.nb, data = excluded.data`,
          [live, p.id, p.nb, JSON.stringify(data)],
        );
        return NextResponse.json({ ok: true });
      }
      case 'delpage': {
        if (!okId(b.id)) break;
        await sql.exec(`delete from live_tr_items where live_id = $1 and page_id = $2`, [live, b.id]);
        await sql.exec(`delete from live_tr_pages where live_id = $1 and id = $2`, [live, b.id]);
        return NextResponse.json({ ok: true });
      }
      case 'items': {
        if (!okId(b.pg)) break;
        const del = (Array.isArray(b.d) ? b.d : []).filter(okId).slice(0, 5000);
        const put = (Array.isArray(b.p) ? b.p : []).filter((it) => it && okId(it.id)).slice(0, 2000);
        if (del.length) await sql.exec(`delete from live_tr_items where live_id = $1 and page_id = $2 and id = any($3)`, [live, b.pg, del]);
        const rows = put.map((it) => ({ id: it.id, data: JSON.stringify(it) })).filter((r) => r.data.length <= MAX_ITEM);
        if (rows.length)
          await sql.exec(
            `insert into live_tr_items (live_id, page_id, id, data) select $1, $2, x.id, x.data from unnest($3::text[], $4::text[]) as x(id, data)
             on conflict (live_id, page_id, id) do update set data = excluded.data`,
            [live, b.pg, rows.map((r) => r.id), rows.map((r) => r.data)],
          );
        return NextResponse.json({ ok: true });
      }
      case 'addpdf': {
        const f = b.file;
        if (!f || typeof f.path !== 'string') break;
        const r = await addLiveMaterials(live, [{ title: String(f.title ?? 'PDF'), path: f.path, size: String(f.size ?? '') }]);
        if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
        return NextResponse.json({ ok: true, id: r.ids?.[0] });
      }
    }
    return NextResponse.json({ error: 'Inválido.' }, { status: 400 });
  } catch (e) {
    console.error('[traco]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Falha ao salvar.' }, { status: 500 });
  }
}
