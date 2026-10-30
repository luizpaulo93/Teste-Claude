'use server';

import { revalidatePath } from 'next/cache';
import { fail, requireAdminAction, type ActionResult } from '@/lib/admin/guard';
import { newId, sql } from '@/lib/db';
import { ASSUNTO_BY_KEY } from '@/lib/enem-matriz';
import { applyBlock, getBlock, releaseBlock, type BlockFile } from '@/lib/mentoria-blocks';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function refresh() {
  revalidatePath('/mentoria', 'layout');
  revalidatePath('/admin/mentoria', 'layout');
}

async function spaceExists(space: string) {
  if (!/^[mg]:[^/]{1,200}$/.test(space)) return false;
  const table = space.startsWith('m:') ? 'mentorias' : 'mentoria_groups';
  return Boolean(await sql.one(`select 1 from ${table} where id = $1`, [space.slice(2)]));
}

/** Mentor cria/edita um período: assuntos de um dia, de vários dias, de uma semana ou de um mês, com apostilas. */
export async function saveBlock(data: {
  id?: string;
  space: string;
  title: string;
  item_keys: string[];
  start_on: string;
  end_on: string;
  files: BlockFile[];
}): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!(await spaceExists(data.space))) return { error: 'Mentoria não encontrada.' };
    if (!DATE.test(data.start_on) || !DATE.test(data.end_on)) return { error: 'Escolha o período.' };
    if (data.end_on < data.start_on) return { error: 'O fim do período é antes do início.' };
    const keys = [...new Set((data.item_keys ?? []).filter((k) => ASSUNTO_BY_KEY.has(k)))].slice(0, 200);
    const files = (data.files ?? [])
      .filter((f) => typeof f.file_path === 'string' && /^mentoria\/[\w/-]+\.pdf$/.test(f.file_path))
      .slice(0, 40)
      .map((f) => ({ id: String(f.id || newId()).slice(0, 40), title: String(f.title || 'Apostila').slice(0, 160), file_path: f.file_path, size_label: String(f.size_label ?? '').slice(0, 20) }));
    const title = String(data.title ?? '').trim().slice(0, 160);
    if (!keys.length && !files.length) return { error: 'Escolha pelo menos um assunto ou envie uma apostila.' };

    let id = data.id;
    if (id) {
      const old = await getBlock(id);
      if (!old || old.space !== data.space) return { error: 'Período não encontrado.' };
      const removed = old.item_keys.filter((k) => !keys.includes(k));
      if (removed.length) await releaseBlock(id, removed);
      await sql.exec(
        `update mentoria_blocks set title = $2, item_keys = $3, start_on = $4, end_on = $5, files = $6, file_paths = $7, updated_at = now() where id = $1`,
        [id, title, keys, data.start_on, data.end_on, JSON.stringify(files), files.map((f) => f.file_path)],
      );
    } else {
      id = newId();
      await sql.exec(
        `insert into mentoria_blocks (id, space, title, item_keys, start_on, end_on, files, file_paths) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, data.space, title, keys, data.start_on, data.end_on, JSON.stringify(files), files.map((f) => f.file_path)],
      );
    }
    const b = await getBlock(id);
    if (b) await applyBlock(b);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteBlock(id: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!id || id.length > 64) return { error: 'Inválido.' };
    await releaseBlock(id);
    await sql.exec(`delete from mentoria_blocks where id = $1`, [id]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
